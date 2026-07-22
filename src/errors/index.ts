export type { ResultWarning, RecoveryHint } from '../types';

// ─── Error Classification ───────────────────────────────────────────────────

import { PocketPayError } from '../types';

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
