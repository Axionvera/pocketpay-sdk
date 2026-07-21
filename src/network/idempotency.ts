import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer } from '../config';
import { PocketPayError, SDKConfig } from '../types';
import { classifySubmitError } from '../errors';

export interface IdempotencyOptions {
  /** Maximum number of poll attempts (default: 10) */
  maxPollAttempts?: number;
  /** Delay between poll attempts in milliseconds (default: 2000) */
  pollIntervalMs?: number;
}

/**
 * Submits a transaction to Horizon with idempotency handling.
 * If a timeout or network error occurs during submission, it polls Horizon
 * to check if the transaction eventually succeeded, up until the transaction's
 * maxTime bounds or maximum poll attempts.
 *
 * @param transaction - The transaction to submit (Transaction or FeeBumpTransaction)
 * @param options - Polling interval and max attempts configuration
 * @param config - Optional SDK config overrides
 * @returns The successful submission transaction response from Horizon
 */
export async function submitTransactionIdempotently(
  transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
  options: IdempotencyOptions = {},
  config?: Partial<SDKConfig>
): Promise<any> {
  const txHash = transaction.hash().toString('hex');
  const server = getHorizonServer(config);

  try {
    const result = await server.submitTransaction(transaction);
    return result;
  } catch (error) {
    const classified = classifySubmitError(error, txHash);

    // If the status is unknown (timeout/network error), we poll for the status instead of throwing immediately.
    if (classified.code === 'TX_STATUS_UNKNOWN') {
      return await pollTransactionStatus(transaction, options, config);
    }

    throw classified;
  }
}

/**
 * Polls Horizon for the status of a transaction by its hash.
 * If not found, continues polling until the transaction's maxTime is reached,
 * or maxPollAttempts is exceeded.
 *
 * @param transaction - The transaction to check status for
 * @param options - Polling options (maxPollAttempts, pollIntervalMs)
 * @param config - Optional SDK config overrides
 * @returns The transaction record from Horizon once successfully found
 */
export async function pollTransactionStatus(
  transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
  options: IdempotencyOptions = {},
  config?: Partial<SDKConfig>
): Promise<any> {
  const txHash = transaction.hash().toString('hex');
  const server = getHorizonServer(config);
  const maxPollAttempts = options.maxPollAttempts ?? 10;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  // Retrieve maxTime from the transaction's timeBounds (handle both Transaction & FeeBumpTransaction)
  let maxTime: bigint | undefined;
  if ('timeBounds' in transaction && transaction.timeBounds) {
    maxTime = BigInt(transaction.timeBounds.maxTime);
  } else if ('innerTransaction' in transaction && (transaction as any).innerTransaction?.timeBounds) {
    maxTime = BigInt((transaction as any).innerTransaction.timeBounds.maxTime);
  }

  for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
    // Check if the transaction has expired based on local system time
    if (maxTime && maxTime > 0n) {
      const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));
      if (nowInSeconds > maxTime) {
        throw new PocketPayError(
          `Transaction expired on-chain (maxTime bounds exceeded: ${maxTime.toString()})`,
          'TX_EXPIRED',
          400,
          undefined,
          txHash,
          false
        );
      }
    }

    try {
      // Query Horizon for the transaction details
      const txRecord = await server.transactions().transaction(txHash).call();
      if (txRecord) {
        return txRecord;
      }
    } catch (error: any) {
      // Horizon returns 404 (Not Found) if the transaction hasn't been included in a ledger yet.
      const isNotFound = error?.response?.status === 404 || error?.status === 404;
      if (!isNotFound) {
        const classified = classifySubmitError(error, txHash);
        if (classified.code !== 'TX_STATUS_UNKNOWN') {
          throw classified;
        }
      }
    }

    // Wait before the next poll attempt
    if (attempt < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new PocketPayError(
    `Failed to determine transaction status after ${maxPollAttempts} attempts.`,
    'TX_STATUS_UNKNOWN',
    504,
    undefined,
    txHash,
    false
  );
}
