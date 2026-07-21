import { PocketPayError } from '../types';

/**
 * Classifies a transaction submission error to determine retryability and format properties.
 *
 * @param error - The raw error caught from Horizon or the network client
 * @param txHash - The computed transaction hash
 * @returns An enriched PocketPayError
 */
export function classifySubmitError(error: any, txHash?: string): PocketPayError {
  if (error instanceof PocketPayError) {
    return error;
  }

  const statusCode = error?.response?.status || error?.status;
  const message = error?.message || String(error);

  // 1. Stellar Horizon response error with specific transaction/operation results
  const resultCodes = error?.response?.data?.extras?.result_codes;
  if (resultCodes) {
    const txCode = resultCodes.transaction;
    const opCodes = resultCodes.operations || [];

    // Final, non-retryable Stellar transaction results
    const nonRetryableCodes = [
      'tx_bad_auth',
      'tx_bad_auth_extra',
      'tx_bad_seq',
      'tx_insufficient_balance',
      'tx_missing_operations',
      'tx_too_early',
      'tx_too_late',
      'tx_no_source_account',
      'tx_bad_minseq_age_or_gap',
      'tx_bad_sponsor',
    ];

    const isRetryable = !nonRetryableCodes.includes(txCode);
    return new PocketPayError(
      `Payment failed: tx=${txCode}, ops=${JSON.stringify(opCodes)}`,
      'PAYMENT_FAILED',
      statusCode || 400,
      error instanceof Error ? error : undefined,
      txHash,
      isRetryable
    );
  }

  // 2. Gateway, server overload, socket timeouts, or rate limits
  const timeoutErrorCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'TIMEOUT'];
  const errorMsgUpper = message.toUpperCase();
  const isTimeout =
    timeoutErrorCodes.includes(error?.code) ||
    errorMsgUpper.includes('TIMEOUT') ||
    errorMsgUpper.includes('NETWORK') ||
    statusCode === 504 ||
    statusCode === 502 ||
    statusCode === 503;

  if (isTimeout) {
    // If submission times out/fails due to network, status is unknown.
    // Blind retries are prohibited without querying status first.
    return new PocketPayError(
      `Transaction submission status is unknown (network timeout): ${message}`,
      'TX_STATUS_UNKNOWN',
      statusCode || 504,
      error instanceof Error ? error : undefined,
      txHash,
      false
    );
  }

  // 3. Other HTTP errors
  const isRetryable = statusCode === 429; // Rate limit is retryable after cooling down
  return new PocketPayError(
    `Failed to submit transaction: ${message}`,
    'SEND_ERROR',
    statusCode,
    error instanceof Error ? error : undefined,
    txHash,
    isRetryable
  );
}

/**
 * Checks if a pocketpay error is classified as retryable.
 */
export function isRetryableError(error: unknown): boolean {
  return error instanceof PocketPayError && !!error.retryable;
}

/**
 * Checks if a pocketpay error indicates that the transaction status is unknown.
 */
export function isUnknownStatusError(error: unknown): boolean {
  return error instanceof PocketPayError && error.code === 'TX_STATUS_UNKNOWN';
}
