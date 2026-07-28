/**
 * Stellar PocketPay SDK — Payment receipt builder.
 *
 * Reconciles the SDK's two submission-side taxonomies into a single, display-
 * ready {@link PaymentReceipt}. See `src/types/receipt.ts` for why the
 * existing {@link TransactionStatus} enum is reused instead of a new one.
 *
 * @remarks
 * The builders in this module **never throw**. A receipt describes an attempt
 * that has already happened, including failed ones; throwing while building it
 * would leave a consumer with no way to render the outcome at all.
 *
 * @security No raw error object, XDR, envelope or RPC payload is copied into a
 * receipt. See {@link ReceiptFailure}.
 */

import type {
  PocketPayError,
  SorobanInvocationResult,
  SorobanInvocationStatus,
  StellarNetwork,
  SubmissionOutcome,
} from '../types';
import { TransactionStatus } from '../types/transaction';
import type { PaymentReceipt, ReceiptAction, ReceiptFailure } from '../types/receipt';
import { getTransactionExplorerLink } from '../utils/explorer';
import { resolveConfig } from '../config';

/**
 * Options for the receipt builders.
 *
 * The contextual fields (`amount`, `asset`, `destination`, `memo`) are pass-
 * through: the SDK does not re-derive them from the network, it records what
 * the caller asked for.
 *
 * @remarks
 * This type lives here rather than in `src/types/receipt.ts` because it needs
 * `StellarNetwork`, which is declared in `src/types/index.ts`. Importing that
 * barrel from one of its own members would create the cycle
 * `types/index.ts -> types/receipt.ts -> types/index.ts`, which
 * `pnpm check:circular` rejects.
 */
export interface PaymentReceiptOptions {
  /**
   * Network used to build the explorer link. When omitted the builder falls
   * back to the resolved SDK config; if that cannot be resolved, the receipt
   * is still produced, just without `explorerUrl`.
   */
  network?: StellarNetwork;
  /** Amount as requested by the caller. */
  amount?: string;
  /** Asset code as requested by the caller. */
  asset?: string;
  /** Destination account as requested by the caller. */
  destination?: string;
  /** Memo as requested by the caller. */
  memo?: string;
  /** Soroban operation name. */
  operation?: string;
  /** Soroban contract ID. */
  contractId?: string;
  /** Clock injection point, so tests can assert a deterministic `createdAt`. */
  now?: () => Date;
}

/** Fallback used when an error carries no vetted display message. */
const GENERIC_FAILURE_MESSAGE = 'The payment could not be completed.';

/** Fallback used for Soroban failures, whose raw text is not propagated. */
const GENERIC_SOROBAN_FAILURE_MESSAGE = 'The contract operation did not succeed.';

interface OutcomeMapping {
  status: TransactionStatus;
  actionRequired: ReceiptAction;
}

/**
 * Maps a classic Horizon submission outcome onto a display status.
 *
 * @remarks
 * Two mappings here are deliberate and are the reason this module exists:
 *
 * - `unknown_status` becomes {@link TransactionStatus.UNKNOWN}, **never
 *   `FAILED`**. It is what a submission timeout classifies to, and the
 *   transaction may already have been accepted by validators. Rendering it as
 *   a failure would tell someone their payment did not happen when it may
 *   well have.
 * - `retryable_failure` becomes {@link TransactionStatus.PENDING}, not
 *   `FAILED`. The same signed envelope may still be resubmitted, so the
 *   attempt is unresolved rather than rejected.
 */
function mapSubmissionOutcome(outcome: SubmissionOutcome): OutcomeMapping {
  switch (outcome.kind) {
    case 'success':
      return { status: TransactionStatus.COMPLETED, actionRequired: 'none' };
    case 'retryable_failure':
      return { status: TransactionStatus.PENDING, actionRequired: 'retry' };
    case 'non_retryable_failure':
      return { status: TransactionStatus.FAILED, actionRequired: 'rebuild' };
    case 'unknown_status':
      return { status: TransactionStatus.UNKNOWN, actionRequired: 'poll' };
    default: {
      // Exhaustiveness guard: adding a variant to SubmissionOutcome without
      // handling it here becomes a compile error rather than a silent
      // mis-render. The value is not interpolated into the message so that an
      // unexpected payload cannot leak through this branch.
      const exhaustive: never = outcome;
      void exhaustive;
      return { status: TransactionStatus.UNKNOWN, actionRequired: 'poll' };
    }
  }
}

/**
 * Maps a Soroban invocation status onto a display status.
 *
 * `simulation_error` and `error` join `failed`: all three are terminal for the
 * attempt as built, so the caller has to rebuild rather than retry.
 */
function mapSorobanStatus(status: SorobanInvocationStatus): OutcomeMapping {
  switch (status) {
    case 'success':
      return { status: TransactionStatus.COMPLETED, actionRequired: 'none' };
    case 'pending':
      return { status: TransactionStatus.PENDING, actionRequired: 'poll' };
    case 'failed':
    case 'error':
    case 'simulation_error':
      return { status: TransactionStatus.FAILED, actionRequired: 'rebuild' };
    default: {
      const exhaustive: never = status;
      void exhaustive;
      return { status: TransactionStatus.UNKNOWN, actionRequired: 'poll' };
    }
  }
}

/**
 * Projects an SDK error down to the two fields a receipt is allowed to carry.
 */
function toReceiptFailure(error: PocketPayError): ReceiptFailure {
  return {
    code: error.code,
    safeMessage: error.safeMessage ?? GENERIC_FAILURE_MESSAGE,
  };
}

/**
 * Resolves the network for the explorer link.
 *
 * An explicit option always wins. Otherwise the SDK config is consulted, and
 * if that cannot be resolved the receipt is still produced — only without a
 * link. Receipt building must not fail because configuration is incomplete.
 */
function resolveNetwork(network?: StellarNetwork): StellarNetwork | undefined {
  if (network !== undefined) return network;
  try {
    return resolveConfig().network;
  } catch {
    return undefined;
  }
}

/**
 * Builds the explorer link, tolerating a malformed or absent hash.
 */
function buildExplorerUrl(
  transactionHash: string | undefined,
  network: StellarNetwork | undefined,
): string | undefined {
  if (!transactionHash || !network) return undefined;
  try {
    return getTransactionExplorerLink(transactionHash, network);
  } catch {
    return undefined;
  }
}

/** Shared assembly for both entry points. */
function assembleReceipt(
  source: PaymentReceipt['source'],
  mapping: OutcomeMapping,
  transactionHash: string | undefined,
  failure: ReceiptFailure | undefined,
  options: PaymentReceiptOptions,
): PaymentReceipt {
  const network = resolveNetwork(options.network);
  const createdAt = (options.now ? options.now() : new Date()).toISOString();

  const receipt: PaymentReceipt = {
    status: mapping.status,
    source,
    actionRequired: mapping.actionRequired,
    createdAt,
  };

  if (transactionHash !== undefined) receipt.transactionHash = transactionHash;

  const explorerUrl = buildExplorerUrl(transactionHash, network);
  if (explorerUrl !== undefined) receipt.explorerUrl = explorerUrl;

  if (options.amount !== undefined) receipt.amount = options.amount;
  if (options.asset !== undefined) receipt.asset = options.asset;
  if (options.destination !== undefined) receipt.destination = options.destination;
  if (options.memo !== undefined) receipt.memo = options.memo;
  if (options.operation !== undefined) receipt.operation = options.operation;
  if (options.contractId !== undefined) receipt.contractId = options.contractId;
  if (failure !== undefined) receipt.failure = failure;

  return receipt;
}

/**
 * Builds a receipt from a classic Horizon submission outcome.
 *
 * @param outcome - Result of {@link classifySubmissionOutcome}.
 * @param options - Display context and explorer network.
 * @returns A display-ready receipt. Never throws.
 *
 * @example
 * ```ts
 * const outcome = classifySubmissionOutcome(undefined, hash);
 * const receipt = buildReceiptFromSubmission(outcome, { network: 'testnet' });
 * // receipt.status === TransactionStatus.COMPLETED
 * ```
 */
export function buildReceiptFromSubmission(
  outcome: SubmissionOutcome,
  options: PaymentReceiptOptions = {},
): PaymentReceipt {
  const mapping = mapSubmissionOutcome(outcome);

  const transactionHash =
    outcome.kind === 'success' || outcome.kind === 'unknown_status'
      ? outcome.transactionHash
      : undefined;

  const failure =
    outcome.kind === 'success' ? undefined : toReceiptFailure(outcome.error);

  return assembleReceipt('submission', mapping, transactionHash, failure, options);
}

/**
 * Builds a receipt from a Soroban invocation result.
 *
 * @remarks
 * `SorobanInvocationResult.error` and `rawResponse` are **not** copied into
 * the receipt: the first is free-form text from the RPC node and the second is
 * an unbounded payload. `errorCode` is preserved as the receipt's error code
 * when present.
 *
 * @param result - Result of a Soroban invocation or vault mapper.
 * @param options - Display context and explorer network.
 * @returns A display-ready receipt. Never throws.
 */
export function buildReceiptFromSoroban(
  result: SorobanInvocationResult,
  options: PaymentReceiptOptions = {},
): PaymentReceipt {
  const mapping = mapSorobanStatus(result.status);

  const failure: ReceiptFailure | undefined =
    mapping.status === TransactionStatus.FAILED
      ? {
          code: result.errorCode !== undefined ? String(result.errorCode) : 'SOROBAN_INVOCATION_FAILED',
          safeMessage: GENERIC_SOROBAN_FAILURE_MESSAGE,
        }
      : undefined;

  return assembleReceipt('soroban', mapping, result.hash, failure, options);
}

/**
 * Single entry point that accepts either taxonomy.
 *
 * Discriminates on the presence of the `kind` field, which only
 * {@link SubmissionOutcome} carries.
 *
 * @param source - A submission outcome or a Soroban invocation result.
 * @param options - Display context and explorer network.
 * @returns A display-ready receipt. Never throws.
 */
export function buildPaymentReceipt(
  source: SubmissionOutcome | SorobanInvocationResult,
  options: PaymentReceiptOptions = {},
): PaymentReceipt {
  return 'kind' in source
    ? buildReceiptFromSubmission(source, options)
    : buildReceiptFromSoroban(source, options);
}
