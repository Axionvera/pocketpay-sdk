/**
 * auth.ts — maps a transaction's authorisation requirements into typed metadata.
 * ──────────────────────────────────────────────────────────────────────────────
 * Before this module a consumer had no way to learn what a transaction needed
 * before attempting it. The information existed on both sides and was thrown
 * away on both:
 *
 *  - **Classic Stellar** — Horizon returns `signers` and `thresholds` on every
 *    account load, but nothing in `src/` read either, so a multisig account
 *    could not discover that a payment needs two signatures until submission
 *    failed.
 *  - **Soroban** — `simulateTransaction` returns `result.auth`, the
 *    authorisation entries naming which addresses must approve the invocation.
 *    `client-factory.ts` read only `result.retval` and discarded them, while
 *    `assembleTransaction` consumed the same entries internally to sign. The
 *    SDK acted on requirements it never surfaced.
 *
 * The mapper is deliberately **pure**: it takes a built transaction and, when
 * available, the account state, and computes requirements without touching the
 * network. That keeps it fully testable offline and lets callers decide when to
 * pay for a Horizon round trip.
 *
 * Nothing here holds or derives key material — only public keys, weights and
 * thresholds.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import type {
  AuthAccountState,
  AuthRequirement,
  AuthRequirementSummary,
  AuthSigner,
  AuthThresholdLevel,
} from '../types';
import { UnsupportedFeatureError } from '../errors/unsupported';

/**
 * Threshold each operation type requires, per the Stellar protocol.
 *
 * Operations absent from this table are reported through
 * `unsupportedOperations` rather than guessed at — assuming a threshold for an
 * unknown operation is exactly the unsafe signing assumption to avoid.
 */
const OPERATION_THRESHOLDS: Record<string, AuthThresholdLevel> = {
  // ─── Medium threshold: the everyday operations ───────────────────────────
  payment: 'medium',
  pathPaymentStrictReceive: 'medium',
  pathPaymentStrictSend: 'medium',
  createAccount: 'medium',
  changeTrust: 'medium',
  manageSellOffer: 'medium',
  manageBuyOffer: 'medium',
  createPassiveSellOffer: 'medium',
  manageData: 'medium',
  bumpSequence: 'medium',
  createClaimableBalance: 'medium',
  claimClaimableBalance: 'medium',
  beginSponsoringFutureReserves: 'medium',
  endSponsoringFutureReserves: 'medium',
  revokeSponsorship: 'medium',
  clawback: 'medium',
  clawbackClaimableBalance: 'medium',
  liquidityPoolDeposit: 'medium',
  liquidityPoolWithdraw: 'medium',
  invokeHostFunction: 'medium',
  extendFootprintTtl: 'medium',
  restoreFootprint: 'medium',

  // ─── Low threshold ───────────────────────────────────────────────────────
  allowTrust: 'low',
  setTrustLineFlags: 'low',

  // ─── High threshold: operations that can change control of the account ───
  accountMerge: 'high',
};

/** Ranks thresholds so the highest can be selected. */
const THRESHOLD_RANK: Record<AuthThresholdLevel, number> = { low: 0, medium: 1, high: 2 };

/** Returns whichever threshold is stricter. */
function stricter(
  a: AuthThresholdLevel | undefined,
  b: AuthThresholdLevel
): AuthThresholdLevel {
  if (!a) return b;
  return THRESHOLD_RANK[b] > THRESHOLD_RANK[a] ? b : a;
}

/** Reads `setOptions`, which needs `high` only when it changes signing control. */
function setOptionsThreshold(operation: StellarSDK.Operation.SetOptions): AuthThresholdLevel {
  const changesControl =
    operation.masterWeight !== undefined ||
    operation.lowThreshold !== undefined ||
    operation.medThreshold !== undefined ||
    operation.highThreshold !== undefined ||
    operation.signer !== undefined;
  return changesControl ? 'high' : 'medium';
}

/**
 * Extracts the public keys that have already signed a transaction.
 *
 * Signature hints are the last four bytes of the signer's public key, so a hint
 * can be matched against a known signer list without touching secret material.
 * Only signers supplied in `candidates` can be identified.
 */
export function identifyPresentSigners(
  transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
  candidates: readonly string[] = []
): string[] {
  const hints = new Set(
    transaction.signatures.map((signature) => signature.hint().toString('hex'))
  );

  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      const hint = StellarSDK.Keypair.fromPublicKey(candidate)
        .signatureHint()
        .toString('hex');
      if (hints.has(hint)) found.push(candidate);
    } catch {
      // Not a valid public key; skip rather than fail the whole summary.
    }
  }
  return found;
}

/** Options accepted by {@link mapAuthRequirements}. */
export interface MapAuthRequirementsOptions {
  /**
   * The source account's signers and thresholds. Supply it to resolve required
   * weights and eligible signers; omit it for an envelope-only summary.
   */
  account?: AuthAccountState;
  /**
   * Soroban authorisation entries from a simulation response — pass
   * `simulated.result?.auth`. The mapper does not simulate on your behalf.
   */
  sorobanAuth?: readonly StellarSDK.xdr.SorobanAuthorizationEntry[];
}

/**
 * Maps a transaction's authorisation requirements into typed metadata.
 *
 * Works with whatever it is given: without `account` it still reports which
 * threshold each operation needs and which signatures are present; with it, the
 * required weights, eligible signers and whether the transaction is satisfied.
 *
 * @param transaction - The built transaction, signed or not
 * @param options - Optional account state and Soroban authorisation entries
 * @returns Typed authorisation metadata
 *
 * @example
 * ```ts
 * const summary = mapAuthRequirements(transaction, { account });
 * if (summary.satisfied === false) {
 *   console.log('Still needs:', summary.unmet);
 * }
 * ```
 */
export function mapAuthRequirements(
  transaction: StellarSDK.Transaction,
  options: MapAuthRequirementsOptions = {}
): AuthRequirementSummary {
  const { account, sorobanAuth } = options;
  const sourceAccount = transaction.source;

  const byThreshold = new Map<AuthThresholdLevel, number[]>();
  const unsupportedOperations: string[] = [];
  let highestThreshold: AuthThresholdLevel | undefined;

  transaction.operations.forEach((operation, index) => {
    const type = operation.type;

    let threshold: AuthThresholdLevel | undefined;
    if (type === 'setOptions') {
      threshold = setOptionsThreshold(operation as StellarSDK.Operation.SetOptions);
    } else {
      threshold = OPERATION_THRESHOLDS[type];
    }

    if (!threshold) {
      // Unknown operation: record it rather than assume a threshold.
      if (!unsupportedOperations.includes(type)) unsupportedOperations.push(type);
      return;
    }

    highestThreshold = stricter(highestThreshold, threshold);
    const indexes = byThreshold.get(threshold) ?? [];
    indexes.push(index);
    byThreshold.set(threshold, indexes);
  });

  const requirements: AuthRequirement[] = [];

  for (const [threshold, operationIndexes] of byThreshold) {
    requirements.push({
      kind: 'account_signature',
      account: sourceAccount,
      threshold,
      requiredWeight: account?.thresholds[threshold],
      eligibleSigners: account?.signers,
      operationIndexes,
    });
  }

  // Soroban entries name addresses that must approve the invocation. They are
  // independent of account thresholds — satisfying one does not satisfy the other.
  if (sorobanAuth?.length) {
    for (const entry of sorobanAuth) {
      const address = readAuthorizingAddress(entry);
      if (address) {
        requirements.push({
          kind: 'contract_authorization',
          account: address,
          operationIndexes: [],
        });
      }
    }
  }

  const knownSigners = account?.signers.map((signer) => signer.key) ?? [];
  const presentSigners = identifyPresentSigners(transaction, knownSigners);

  let satisfied: boolean | undefined;
  let unmet: AuthRequirement[] | undefined;

  // Only decidable with account data, no unclassified operations, and no
  // contract authorisations — those are approved on-chain, not by signature
  // weight, so their satisfaction cannot be judged from the envelope.
  const hasContractAuth = requirements.some((r) => r.kind === 'contract_authorization');
  if (account && unsupportedOperations.length === 0 && !hasContractAuth) {
    const weight = presentSigners.reduce((total, key) => {
      const signer = account.signers.find((candidate) => candidate.key === key);
      return total + (signer?.weight ?? 0);
    }, 0);

    unmet = requirements.filter(
      (requirement) =>
        requirement.requiredWeight !== undefined && weight < requirement.requiredWeight
    );
    satisfied = unmet.length === 0;
  }

  return {
    sourceAccount,
    requirements,
    highestThreshold,
    presentSigners,
    satisfied,
    unmet,
    unsupportedOperations,
  };
}

/** Reads the authorising address from a Soroban authorisation entry. */
function readAuthorizingAddress(
  entry: StellarSDK.xdr.SorobanAuthorizationEntry
): string | undefined {
  try {
    const credentials = entry.credentials();
    // Source-account credentials are covered by the transaction's own
    // signature; only address credentials name a separate authoriser.
    if (credentials.switch().name === 'sorobanCredentialsAddress') {
      return StellarSDK.Address.fromScAddress(
        credentials.address().address()
      ).toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Throws the standard unsupported-feature error for an operation the mapper
 * cannot classify.
 *
 * Use this when a caller requires a complete picture and cannot proceed with an
 * unclassified operation.
 *
 * @param summary - A summary produced by {@link mapAuthRequirements}
 * @throws UnsupportedFeatureError when any operation went unclassified
 */
export function assertAuthFullyMapped(summary: AuthRequirementSummary): void {
  if (summary.unsupportedOperations.length === 0) return;

  throw new UnsupportedFeatureError({
    module: 'transactions',
    operation: 'mapAuthRequirements',
    capability: `auth.operation.${summary.unsupportedOperations[0]}`,
    message:
      `Cannot determine authorisation requirements for operation type(s): ` +
      `${summary.unsupportedOperations.join(', ')}.`,
  });
}

/**
 * Builds {@link AuthAccountState} from a Horizon account record.
 *
 * Kept separate from the mapper so the mapper stays pure — call this with an
 * account you already loaded.
 *
 * @param account - A Horizon account record
 */
export function toAuthAccountState(account: {
  accountId?: (() => string) | string;
  account_id?: string;
  signers?: ReadonlyArray<{ key: string; weight: number; type?: string }>;
  thresholds?: { low_threshold: number; med_threshold: number; high_threshold: number };
}): AuthAccountState {
  const accountId =
    typeof account.accountId === 'function'
      ? account.accountId()
      : (account.accountId ?? account.account_id ?? '');

  const signers: AuthSigner[] = (account.signers ?? []).map((signer) => ({
    key: signer.key,
    weight: signer.weight,
    type: signer.type,
  }));

  return {
    accountId,
    signers,
    thresholds: {
      low: account.thresholds?.low_threshold ?? 0,
      medium: account.thresholds?.med_threshold ?? 0,
      high: account.thresholds?.high_threshold ?? 0,
    },
  };
}
