/**
 * Stellar PocketPay SDK — Transaction build validation pipeline.
 *
 * Validates the inputs a transaction is built from, in a documented order,
 * before anything is built or signed.
 *
 * @remarks
 * The duplication this replaces was literal, not hypothetical:
 * `src/payments/index.ts` hand-chained `validateSecretKey`,
 * `validatePublicKey`, `validateAmount` and `validateMemoInput`, and the same
 * four calls reappeared in the issued-asset path with `validateAssetSpec`
 * appended.
 *
 * A non-throwing family already existed that the build path never used, but it
 * could not simply be called in sequence: the four helpers return **four
 * different shapes** —
 *
 * - `safeValidateMemo` → `{ valid } | { valid, error }`
 * - `safeParseAmount` → `{ valid, amount } | { valid, error }`
 * - `safeValidateDestination` → `Promise<PocketPayResult<…>>`
 * - `validateSendXLMParams` → `{ ok } | { ok, errors: ValidationError[] }`
 *
 * Normalising those into one result is the work here. The error **codes are
 * transported, never merged**: `ValidationErrorCode` and the published error
 * registry are separate taxonomies on purpose, and collapsing them would break
 * existing tests.
 *
 * @security Issues carry a code and a message. The input is never echoed back —
 * a build input holds `sourceSecret`.
 */

import { canSignTransaction, type AccountAbstraction } from '../account';
import { resolveConfig } from '../config';
import { validateAssetSpec } from '../payments/trustline';
import { PocketPayError } from '../types';
import type { SDKConfig, StellarAssetSpec } from '../types';
import { safeValidateMemo, validateAmount, validatePublicKey, validateSecretKey } from '../utils';
import * as StellarSDK from '@stellar/stellar-sdk';
import type { MemoInput } from '../types';

/**
 * The seven inputs a transaction is built from, in validation order.
 *
 * Named after the validators the issue lists so the mapping between the
 * acceptance criteria and the code is one to one.
 */
export type ValidationStage =
  | 'sourceAccount'
  | 'destination'
  | 'amount'
  | 'asset'
  | 'memo'
  | 'network'
  | 'signerCapability';

/**
 * The documented order. Local, zero-cost checks run first; anything that reads
 * configuration or an account runs last, so a malformed key is reported without
 * resolving config at all.
 */
export const VALIDATION_ORDER: readonly ValidationStage[] = [
  'sourceAccount',
  'destination',
  'amount',
  'asset',
  'memo',
  'network',
  'signerCapability',
];

/** One validation failure, attributed to the stage that produced it. */
export interface TransactionValidationIssue {
  /** Which input failed. */
  stage: ValidationStage;
  /**
   * The code the originating validator already produced.
   *
   * Carried verbatim from whichever taxonomy raised it. This field does not
   * unify `ValidationErrorCode` with the published registry codes; both appear
   * here unchanged.
   */
  code: string;
  /** The input field, when the validator identified one. */
  field?: string;
  /** Human-readable message, safe to display. */
  message: string;
}

/** Outcome of a full pipeline run. */
export interface TransactionValidationResult {
  /** True when no stage produced an issue. */
  valid: boolean;
  /** Every issue found, in stage order. Empty when `valid`. */
  issues: TransactionValidationIssue[];
}

/** Inputs a transaction can be built from. Every field is optional: a stage is skipped when its input is absent. */
export interface TransactionBuildInput {
  /** Secret key of the source account. */
  sourceSecret?: string;
  /** Destination account public key. */
  destination?: string;
  /** Amount as a decimal string. */
  amount?: string;
  /** Asset specification for issued-asset payments. */
  asset?: StellarAssetSpec;
  /** Memo to attach. */
  memo?: string | MemoInput;
  /**
   * Account abstraction used for the signer-capability stage.
   *
   * @remarks
   * This stage validates what can be known **before** a transaction exists:
   * whether the account declares signing capability. Full threshold analysis
   * needs a built envelope and belongs to `mapAuthRequirements`, which runs
   * after building — see the module docs.
   */
  account?: AccountAbstraction;
}

/** Options for a pipeline run. */
export interface TransactionValidationOptions {
  /** SDK config overrides, used by the `network` stage. */
  config?: Partial<SDKConfig>;
  /**
   * Restricts the run to these stages, in {@link VALIDATION_ORDER} regardless
   * of the order given here.
   *
   * @remarks
   * Exists so a caller that already resolves configuration itself can run the
   * input stages without resolving it twice — and, more importantly, without
   * moving *when* a configuration error surfaces relative to the caller's own
   * error handling.
   */
  stages?: readonly ValidationStage[];
  /**
   * Message for the self-payment failure.
   *
   * @remarks
   * `sendXLM` and `sendAsset` word this differently ("Cannot send XLM to
   * yourself" / "Cannot send asset to yourself") and both wordings are asserted
   * by existing tests. The check itself is shared; only the sentence is the
   * caller's.
   */
  selfPaymentMessage?: string;
}

/** Internal: a stage failure keeps the original error so the throwing variant can rethrow it unchanged. */
interface StageFailure {
  issue: TransactionValidationIssue;
  error: PocketPayError;
}

/** Runs a throwing validator and converts a `PocketPayError` into a stage failure. */
function capture(stage: ValidationStage, run: () => void): StageFailure | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    const err = error as PocketPayError;
    if (!err || typeof err.code !== 'string') throw error;
    return {
      error: err,
      issue: {
        stage,
        code: err.code,
        ...(err.validation?.field ? { field: err.validation.field } : {}),
        message: err.safeMessage ?? err.message,
      },
    };
  }
}

/** Converts an already-caught error into a stage failure. */
function fromError(stage: ValidationStage, error: PocketPayError): StageFailure {
  return {
    error,
    issue: {
      stage,
      code: error.code,
      ...(error.validation?.field ? { field: error.validation.field } : {}),
      message: error.safeMessage ?? error.message,
    },
  };
}

/**
 * Runs every applicable stage in {@link VALIDATION_ORDER}.
 *
 * Stages are **not** short-circuited: a caller with three malformed fields gets
 * three issues, so a form can show all of them at once instead of one per
 * submit.
 */
function runStages(
  input: TransactionBuildInput,
  options: TransactionValidationOptions,
): StageFailure[] {
  const failures: StageFailure[] = [];
  const enabled = options.stages ? new Set(options.stages) : undefined;
  const runs = (stage: ValidationStage): boolean => !enabled || enabled.has(stage);

  // 1 — source account. Local, and the only stage that touches the secret.
  let sourceSecretUsable = input.sourceSecret !== undefined;
  if (runs('sourceAccount') && input.sourceSecret !== undefined) {
    const failure = capture('sourceAccount', () => {
      validateSecretKey(input.sourceSecret as string);
    });
    if (failure) {
      failures.push(failure);
      sourceSecretUsable = false;
    }
  }

  // 2 — destination, including self-payment, which needs the derived source.
  if (runs('destination') && input.destination !== undefined) {
    const failure = capture('destination', () => {
      validatePublicKey(input.destination as string);
    });
    if (failure) {
      failures.push(failure);
    } else if (sourceSecretUsable) {
      // Only derive the public key once the secret is known to be well formed.
      // `Keypair.fromSecret` throws a raw Error on a malformed secret, which
      // would escape the pipeline and reach the caller as something other than
      // a PocketPayError.
      const selfPayment = capture('destination', () => {
        const source = StellarSDK.Keypair.fromSecret(input.sourceSecret as string).publicKey();
        if (source === input.destination) {
          throw new PocketPayError(
            options.selfPaymentMessage ?? 'Cannot send to yourself',
            'SELF_PAYMENT',
            {
              validation: {
                field: 'destination',
                reason: 'same_as_source',
                value: input.destination as string,
              },
            },
          );
        }
      });
      if (selfPayment) failures.push(selfPayment);
    }
  }

  // 3 — amount.
  //
  // Uses `validateAmount`, not `safeParseAmount`, and the reason is the same
  // one that keeps the taxonomies apart. `safeParseAmount` belongs to the
  // safe-amount model and raises that model's codes; the payment surface
  // publishes `INVALID_AMOUNT` and `INVALID_AMOUNT_PRECISION`, which existing
  // tests assert. Composing the safe parser here would have been a silent
  // breaking change to published error codes.
  if (runs('amount') && input.amount !== undefined) {
    const failure = capture('amount', () => {
      validateAmount(input.amount as string);
    });
    if (failure) failures.push(failure);
  }

  // 4 — asset shape, for issued-asset payments.
  if (runs('asset') && input.asset !== undefined) {
    const failure = capture('asset', () => {
      validateAssetSpec(input.asset as StellarAssetSpec);
    });
    if (failure) failures.push(failure);
  }

  // 5 — memo.
  if (runs('memo') && input.memo !== undefined) {
    const memoResult = safeValidateMemo(input.memo);
    if (!memoResult.valid) failures.push(fromError('memo', memoResult.error));
  }

  // 6 — network. Resolving config validates URLs, timeout and contract ID.
  if (runs('network')) {
    const networkFailure = capture('network', () => {
      resolveConfig(options.config);
    });
    if (networkFailure) failures.push(networkFailure);
  }

  // 7 — signer capability. See TransactionBuildInput.account for the limit.
  if (runs('signerCapability') && input.account !== undefined && !canSignTransaction(input.account)) {
    failures.push({
      error: new PocketPayError(
        'The provided account cannot sign transactions.',
        'SIGNER_CANNOT_SIGN',
        { validation: { field: 'account', reason: 'cannot_sign' } },
      ),
      issue: {
        stage: 'signerCapability',
        code: 'SIGNER_CANNOT_SIGN',
        field: 'account',
        message:
          'The provided account cannot sign transactions. Full threshold analysis ' +
          'requires a built envelope and is performed by mapAuthRequirements.',
      },
    });
  }

  return failures;
}

/**
 * Validates transaction build inputs without throwing.
 *
 * @param input - The inputs a transaction would be built from.
 * @param options - SDK config overrides for the network stage.
 * @returns Every issue found, in stage order.
 *
 * @example
 * ```ts
 * const result = validateTransactionBuild({ sourceSecret, destination, amount });
 * if (!result.valid) {
 *   for (const issue of result.issues) showFieldError(issue.field, issue.message);
 *   return;
 * }
 * ```
 */
export function validateTransactionBuild(
  input: TransactionBuildInput,
  options: TransactionValidationOptions = {},
): TransactionValidationResult {
  const issues = runStages(input, options).map((failure) => failure.issue);
  return { valid: issues.length === 0, issues };
}

/**
 * Validates and throws the first failure, preserving the original error.
 *
 * @remarks
 * The error thrown is the **same object** the underlying validator produced, so
 * every published error code — `INVALID_SECRET_KEY`, `SELF_PAYMENT`,
 * `INVALID_AMOUNT_PRECISION` and the rest — is unchanged by routing through the
 * pipeline. This is what lets existing flows adopt it without a breaking
 * change.
 *
 * @param input - The inputs a transaction would be built from.
 * @param options - SDK config overrides for the network stage.
 * @throws The originating `PocketPayError` of the first failing stage.
 */
export function assertTransactionBuildValid(
  input: TransactionBuildInput,
  options: TransactionValidationOptions = {},
): void {
  const failures = runStages(input, options);
  if (failures.length > 0) throw failures[0]!.error;
}
