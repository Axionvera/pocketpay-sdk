/**
 * auth.ts — typed authorisation requirement metadata.
 * ──────────────────────────────────────────────────────────────────────────────
 * Stellar authorises a transaction by comparing the combined weight of its
 * signatures against a threshold on the source account. Each operation declares
 * which threshold it needs — low, medium or high — and the account carries the
 * signer list and the three threshold values.
 *
 * Soroban adds a second, independent layer: a contract invocation carries
 * authorisation entries naming the addresses that must approve the call. The
 * simulation response reports them.
 *
 * These types describe both layers without ever holding key material: only
 * public keys, weights and thresholds appear here.
 */

/**
 * Which account threshold an operation must clear.
 *
 * Stellar assigns every operation one of three thresholds. Payments use
 * `medium`; changing an account's signers or thresholds uses `high`.
 */
export type AuthThresholdLevel = 'low' | 'medium' | 'high';

/** How an authorisation requirement is satisfied. */
export type AuthRequirementKind =
  /** A classic Stellar signature weighed against an account threshold. */
  | 'account_signature'
  /** A Soroban authorisation entry naming an address that must approve. */
  | 'contract_authorization';

/**
 * A signer that can contribute weight toward a threshold.
 *
 * Carries the public key only — never secret material.
 */
export interface AuthSigner {
  /** The signer's public key (G...) or other Stellar signer key. */
  readonly key: string;
  /** Weight this signer contributes toward a threshold. */
  readonly weight: number;
  /** Signer type as reported by Horizon, when known. */
  readonly type?: string;
}

/** A single authorisation requirement derived from a transaction. */
export interface AuthRequirement {
  /** How this requirement is satisfied. */
  readonly kind: AuthRequirementKind;
  /** Account or contract address the requirement applies to. */
  readonly account: string;
  /** Threshold level to clear. Only meaningful for `account_signature`. */
  readonly threshold?: AuthThresholdLevel;
  /**
   * Weight the signatures must reach. Present when account data was supplied;
   * absent when the requirement was derived from the envelope alone.
   */
  readonly requiredWeight?: number;
  /** Signers that can contribute, when the account's signer list is known. */
  readonly eligibleSigners?: readonly AuthSigner[];
  /** Operation indexes in the transaction that raised this requirement. */
  readonly operationIndexes: readonly number[];
}

/**
 * The complete authorisation picture for a transaction.
 *
 * `satisfied` is only decidable when account data was supplied and every
 * requirement could be evaluated; otherwise it is `undefined` rather than a
 * guess, so callers never treat an unknown as an approval.
 */
export interface AuthRequirementSummary {
  /** Source account of the transaction. */
  readonly sourceAccount: string;
  /** Every requirement the transaction raises. */
  readonly requirements: readonly AuthRequirement[];
  /** Highest classic threshold any operation needs. */
  readonly highestThreshold?: AuthThresholdLevel;
  /** Public keys that have already signed, derived from the envelope. */
  readonly presentSigners: readonly string[];
  /**
   * Whether the present signatures satisfy every requirement.
   * `undefined` when it cannot be determined — never assume `true`.
   */
  readonly satisfied?: boolean;
  /** Requirements not yet met, when that could be determined. */
  readonly unmet?: readonly AuthRequirement[];
  /** Operation types the mapper could not classify. */
  readonly unsupportedOperations: readonly string[];
}

/**
 * Account data the mapper needs to resolve weights.
 *
 * This is the subset of a Horizon account record that matters for
 * authorisation; pass it in rather than letting the mapper reach the network.
 */
export interface AuthAccountState {
  /** The account's public key. */
  readonly accountId: string;
  /** The account's signers and their weights. */
  readonly signers: readonly AuthSigner[];
  /** The account's three threshold values. */
  readonly thresholds: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
  };
}
