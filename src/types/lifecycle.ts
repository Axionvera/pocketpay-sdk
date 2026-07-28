/**
 * Transaction lifecycle model.
 *
 * Implements the stage boundaries defined in
 * [ADR 0005 — Transaction Lifecycle Architecture](../../docs/adr/0005-transaction-lifecycle.md),
 * which models every write operation as five stages: prepare intent; bind
 * network state and build; authorize and sign; submit; confirm or reconcile.
 *
 * @remarks
 * Two axes are deliberately kept apart:
 *
 * - {@link LifecycleState} — **where** an operation got to.
 * - `TransactionStatus` — **how** it ended.
 *
 * Collapsing them into one union is what produced the incomplete vocabularies
 * this model exists to reconcile: `SubmissionOutcome` has no `pending` and
 * `SorobanInvocationStatus` has no `unknown`, so neither can express both axes
 * on its own.
 *
 * @security Per ADR 0005, once a signed envelope may have reached Horizon a
 * timeout no longer proves the transaction failed. `unresolved` is therefore a
 * distinct state from `rejected`, never a synonym for it.
 */

import type { TransactionStatus } from './transaction';

/**
 * The five stages of ADR 0005.
 *
 * A helper may combine adjacent stages for convenience, but it must preserve
 * the inputs, outputs, error meaning and retry rule of each one.
 */
export type LifecycleStage =
  /** Local validation of keys, amounts, memo and asset shape. No network, no secret. */
  | 'intent'
  /** Bound to sequence, passphrase, fee and time bounds; unsigned envelope exists. */
  | 'build'
  /** Signed by an authorized signer; the envelope and its hash are now immutable. */
  | 'sign'
  /** Handed to Horizon or Soroban RPC — the irreversible boundary. */
  | 'submit'
  /** Read-only status resolution after submission. */
  | 'confirm';

/**
 * Where an operation got to, independent of how it ended.
 *
 * `unresolved` is **not** a failure. It means the signed envelope may already
 * be on-chain and the caller must poll rather than rebuild.
 */
export type LifecycleState =
  /** Intent validated; nothing built yet. */
  | 'intent_prepared'
  /** Unsigned envelope bound to network state. */
  | 'built'
  /** Immutable signed envelope with a transaction hash. */
  | 'signed'
  /** Submitted; the outcome has not been reconciled yet. */
  | 'submitted'
  /** Terminal success — included in a ledger. */
  | 'confirmed'
  /** Terminal rejection — the same envelope will always fail. */
  | 'rejected'
  /** Status unknown. The transaction may or may not be on-chain. */
  | 'unresolved';

/**
 * Safe failure summary carried by a lifecycle result.
 *
 * Mirrors the receipt model: the stable code plus a message vetted for display,
 * never the raw error, XDR or envelope.
 */
export interface LifecycleFailure {
  /** Stable SDK error code, e.g. `TX_STATUS_UNKNOWN`. */
  code: string;
  /** Message vetted for display. */
  safeMessage: string;
}

/**
 * Outcome of running one or more lifecycle stages.
 */
export interface LifecycleResult {
  /** Where the operation got to. */
  state: LifecycleState;
  /** The last stage that was entered. */
  stage: LifecycleStage;
  /** How it ended, reconciled onto the SDK's public display vocabulary. */
  status: TransactionStatus;
  /**
   * What the caller should do next.
   *
   * `poll` is what `unresolved` always carries: the answer exists on-chain and
   * has to be fetched, not guessed.
   */
  actionRequired: 'none' | 'poll' | 'retry' | 'rebuild';
  /** Transaction hash, once the envelope has been signed. */
  transactionHash?: string;
  /** Safe failure summary for non-successful outcomes. */
  failure?: LifecycleFailure;
}
