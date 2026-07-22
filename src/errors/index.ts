export type { ResultWarning, RecoveryHint } from '../types';

// ─── Error Classification ───────────────────────────────────────────────────

import { PocketPayError, SubmissionOutcome } from '../types';

/**
 * Classifies raw network or Horizon submission errors into a structured `PocketPayError`
 * with attached status code, transaction hash, and retryability information.
 *
 * @param error - The raw error thrown by Horizon or fetch
 * @param txHash - Optional transaction hash associated with the submission
 * @returns A classified `PocketPayError`
 */
export function classifySubmitError(error: unknown, txHash?: string): PocketPayError {
  if (error instanceof PocketPayError) {
    if (txHash && !error.transactionHash) {
      (error as any).transactionHash = txHash;
    }
    return error;
  }

  const err = error as any;
  const status = err?.response?.status ?? err?.statusCode ?? err?.status;
  const resultCodes = err?.response?.data?.extras?.result_codes;

  if (resultCodes?.transaction) {
    const txCode = resultCodes.transaction;
    return new PocketPayError(
      `Payment failed with transaction result code: ${txCode}`,
      'PAYMENT_FAILED',
      {
        statusCode: 400,
        cause: err instanceof Error ? err : undefined,
      },
      txHash,
      false,
    );
  }

  const isTimeout =
    status === 504 ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'ENOTFOUND' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('timeout'));

  if (isTimeout) {
    return new PocketPayError(
      `Transaction status unknown after submission attempt for hash ${txHash ?? 'unknown'}`,
      'TX_STATUS_UNKNOWN',
      {
        statusCode: status || 504,
        cause: err instanceof Error ? err : undefined,
      },
      txHash,
      false,
    );
  }

  if (status === 429) {
    return new PocketPayError(
      'Rate limit exceeded (429)',
      'SEND_ERROR',
      {
        statusCode: 429,
        cause: err instanceof Error ? err : undefined,
      },
      txHash,
      true,
    );
  }

  return new PocketPayError(
    `Transaction submission failed: ${err?.message || String(error)}`,
    'SEND_ERROR',
    {
      statusCode: status,
      cause: err instanceof Error ? err : undefined,
    },
    txHash,
    false,
  );
}

/**
 * Checks whether an error is marked as retryable.
 *
 * @param error - The error to check
 * @returns `true` if `error.retryable` is true
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof PocketPayError) {
    return Boolean(error.retryable);
  }
  return false;
}

/**
 * Checks whether an error has code `TX_STATUS_UNKNOWN`.
 *
 * @param error - The error to check
 * @returns `true` if the status of the transaction is unknown
 */
export function isUnknownStatusError(error: unknown): boolean {
  if (error instanceof PocketPayError) {
    return error.code === 'TX_STATUS_UNKNOWN';
  }
  return false;
}

// ─── SubmissionOutcome Classification ───────────────────────────────────────

/**
 * Maps a raw submission result or error into a typed {@link SubmissionOutcome}.
 *
 * This is the primary entry point for categorising **what happened** after a
 * Horizon submission attempt. It produces a discriminated union with four
 * variants:
 *
 * - `"success"` — pass `txHash` and no `error`; represents a confirmed submit.
 * - `"retryable_failure"` — transient errors safe to retry (e.g. rate-limit).
 * - `"non_retryable_failure"` — definitive on-chain rejection; rebuild required.
 * - `"unknown_status"` — timeout/network drop; must poll before any action.
 *
 * Callers that catch a raw error should first run it through
 * {@link classifySubmitError} to obtain a `PocketPayError`, then pass that
 * result here.
 *
 * @example
 * ```ts
 * try {
 *   await server.submitTransaction(tx);
 *   const outcome = classifySubmissionOutcome(undefined, tx.hash().toString('hex'));
 * } catch (rawError) {
 *   const classified = classifySubmitError(rawError, txHash);
 *   const outcome = classifySubmissionOutcome(classified);
 * }
 * ```
 */
export function classifySubmissionOutcome(
  error: PocketPayError | undefined,
  txHash?: string,
): SubmissionOutcome {
  // ── Success path ──────────────────────────────────────────────────────────
  if (!error) {
    if (!txHash) {
      throw new Error(
        'classifySubmissionOutcome: txHash is required when error is undefined (success path)',
      );
    }
    return { kind: 'success', transactionHash: txHash };
  }

  // ── Unknown status (timeout / network drop) ───────────────────────────────
  if (error.code === 'TX_STATUS_UNKNOWN') {
    return {
      kind: 'unknown_status',
      error,
      transactionHash: error.transactionHash ?? txHash,
    };
  }

  // ── Transaction has already expired ───────────────────────────────────────
  // TX_EXPIRED means validators can never accept this envelope. Treat it as a
  // non-retryable failure so callers know they must rebuild, not just wait.
  if (error.code === 'TX_EXPIRED') {
    return { kind: 'non_retryable_failure', error };
  }

  // ── Retryable: rate-limit, transient network ───────────────────────────────
  if (error.retryable === true) {
    // Provide a sensible default backoff. For 429s the caller may use the
    // Retry-After header if available; here we default to 2 s.
    const suggestedDelayMs = error.statusCode === 429 ? 2_000 : 1_000;
    return { kind: 'retryable_failure', error, suggestedDelayMs };
  }

  // ── Definitive rejection (PAYMENT_FAILED, SEND_ERROR, etc.) ───────────────
  return { kind: 'non_retryable_failure', error };
}

/**
 * Returns `true` when it is safe to submit the **same signed transaction
 * envelope** again without first polling Horizon for its current status.
 *
 * Only `"retryable_failure"` outcomes qualify. Both `"unknown_status"` (must
 * poll first) and `"non_retryable_failure"` (must rebuild) return `false`.
 *
 * @example
 * ```ts
 * const outcome = classifySubmissionOutcome(classified);
 * if (isSafeToRetry(outcome)) {
 *   await delay(outcome.suggestedDelayMs);
 *   await submitTransactionIdempotently(tx);
 * }
 * ```
 */
export function isSafeToRetry(outcome: SubmissionOutcome): outcome is Extract<SubmissionOutcome, { kind: 'retryable_failure' }> {
  return outcome.kind === 'retryable_failure';
}

/**
 * Returns `true` when the submission outcome is `"unknown_status"`, meaning
 * the SDK could not determine whether the transaction reached on-chain
 * consensus. The caller **must** check transaction status via
 * {@link pollTransactionStatus} before deciding whether to rebuild or accept.
 *
 * Returning `true` here does **not** mean a retry is safe — it means a
 * status check is *required* before any further action is taken.
 *
 * @example
 * ```ts
 * const outcome = classifySubmissionOutcome(classified);
 * if (requiresStatusCheck(outcome)) {
 *   const txRecord = await pollTransactionStatus(tx, { maxPollAttempts: 10 });
 * }
 * ```
 */
export function requiresStatusCheck(outcome: SubmissionOutcome): outcome is Extract<SubmissionOutcome, { kind: 'unknown_status' }> {
  return outcome.kind === 'unknown_status';
}
