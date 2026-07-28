import { getHorizonServer } from '../config';
import { TransactionPollConfig, TransactionPollResult, TransactionRecord, SDKConfig } from '../types';
import { classifySubmitError } from '../errors';

/**
 * Polls Horizon for the confirmation status of a transaction by its hash.
 * 
 * @param hash - The transaction hash to poll for.
 * @param config - Polling interval and timeout configuration.
 * @param sdkConfig - Optional SDK config overrides.
 * @returns A typed poll result with final status mapping.
 */
export async function pollTransaction(
  hash: string,
  config: TransactionPollConfig = {},
  sdkConfig?: Partial<SDKConfig>
): Promise<TransactionPollResult> {
  const server = getHorizonServer(sdkConfig);
  const interval = config.interval ?? 2000;
  const timeout = config.timeout ?? 30000;
  
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const tx = await server.transactions().transaction(hash).call();
      
      const record: TransactionRecord = {
        hash: tx.hash,
        // `tx.ledger` is Horizon's link-follow helper, not the ledger number —
        // the numeric sequence is exposed as `ledger_attr`.
        ledger: tx.ledger_attr,
        createdAt: tx.created_at,
        sourceAccount: tx.source_account,
        // Horizon types `fee_charged` as `string | number`; the SDK's record
        // keeps fees as strings so stroop values never lose precision.
        fee: String(tx.fee_charged),
        operationCount: tx.operation_count,
        successful: tx.successful,
        memo: tx.memo || undefined,
        memoType: tx.memo_type,
      };

      return {
        status: tx.successful ? 'success' : 'failure',
        hash,
        transaction: record,
      };
    } catch (error: any) {
      const isNotFound = error?.response?.status === 404 || error?.status === 404;
      
      if (!isNotFound) {
        const classified = classifySubmitError(error, hash);
        if (classified.code !== 'TX_STATUS_UNKNOWN') {
          return {
            status: 'unknown',
            hash,
            error: classified.message,
          };
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return {
    status: 'timeout',
    hash,
    error: `Transaction polling timed out after ${timeout}ms`,
  };
}
