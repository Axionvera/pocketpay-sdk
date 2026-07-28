/**
 * Payment receipt model.
 *
 * A receipt is the **display-facing** projection of a payment attempt: the
 * shape an application renders on a confirmation or history screen. It is
 * deliberately narrower than the SDK's internal result types.
 *
 * @remarks
 * Two submission-side taxonomies feed this model and neither covers the four
 * outcomes an app needs on its own:
 *
 * - {@link SubmissionOutcome} (`src/types/index.ts`) has `success`,
 *   `retryable_failure`, `non_retryable_failure` and `unknown_status` —
 *   **no `pending`**.
 * - {@link SorobanInvocationStatus} has `success`, `failed`,
 *   `simulation_error`, `error` and `pending` — **no `unknown`**.
 *
 * Rather than introduce a third vocabulary, receipts reconcile both into the
 * existing public {@link TransactionStatus} enum, whose four members map one
 * to one onto the outcomes an app has to display.
 *
 * @security Receipts never carry raw error objects, XDR, envelopes or raw RPC
 * responses. See {@link ReceiptFailure}.
 */

import type { TransactionStatus } from './transaction';

/** Which SDK path produced the receipt. */
export type ReceiptSource = 'submission' | 'soroban';

/**
 * What the consuming application should do next.
 *
 * This exists so a UI can tell "we do not know yet" apart from "it failed".
 * A receipt whose status is {@link TransactionStatus.UNKNOWN} always carries
 * `'poll'`: the transaction may already be on-chain.
 */
export type ReceiptAction = 'none' | 'poll' | 'retry' | 'rebuild';

/**
 * Safe failure summary attached to a non-successful receipt.
 *
 * @remarks
 * Only the stable error code and the pre-vetted `safeMessage` are carried
 * over. The originating `PocketPayError`, its `cause`, and any raw Soroban
 * RPC payload are intentionally dropped — `DIAGNOSTICS_SENSITIVE_KEYS`
 * classifies `xdr`, `envelope` and `signature` as sensitive, and a receipt is
 * the surface an application is most likely to render or log verbatim.
 * Consumers that need the full error should keep the SDK error object they
 * already hold.
 */
export interface ReceiptFailure {
  /** Stable SDK error code, e.g. `TX_STATUS_UNKNOWN`. */
  code: string;
  /** Message vetted for display; never contains raw network payloads. */
  safeMessage: string;
}

/**
 * Typed, display-ready record of a payment attempt.
 *
 * Every field beyond `status`, `source`, `actionRequired` and `createdAt` is
 * optional: a receipt is buildable from any outcome, including one where the
 * transaction hash was never observed.
 */
export interface PaymentReceipt {
  /** Reconciled outcome, drawn from the existing public enum. */
  status: TransactionStatus;
  /** Which SDK path produced this receipt. */
  source: ReceiptSource;
  /** Next step for the consuming application. */
  actionRequired: ReceiptAction;
  /** Transaction hash, when one was observed. */
  transactionHash?: string;
  /** Stellar.Expert link, present only when a hash and network are known. */
  explorerUrl?: string;
  /** Amount as supplied by the caller. */
  amount?: string;
  /** Asset code as supplied by the caller. */
  asset?: string;
  /** Destination account as supplied by the caller. */
  destination?: string;
  /** Memo as supplied by the caller. */
  memo?: string;
  /** Soroban operation name, e.g. `deposit`. */
  operation?: string;
  /** Soroban contract ID involved, when applicable. */
  contractId?: string;
  /** Safe failure summary for non-successful outcomes. */
  failure?: ReceiptFailure;
  /** ISO-8601 timestamp of receipt creation. */
  createdAt: string;
}

/**
 * Builder options live next to the builder in `src/payments/receipt.ts`.
 *
 * @remarks
 * `PaymentReceiptOptions` needs `StellarNetwork`, which is declared in this
 * module's own barrel (`src/types/index.ts`). Importing it back from there
 * would make `types/index.ts -> types/receipt.ts -> types/index.ts` a cycle,
 * which `pnpm check:circular` rejects — type-only or not. Keeping the options
 * type in the payments module preserves the one-way dependency `payments ->
 * types` that the rest of the SDK already follows.
 */
