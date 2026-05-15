/**
 * Stellar PocketPay SDK — Transactions Module
 *
 * Query transaction history and payment operations for a Stellar account.
 */

import { getHorizonServer } from '../config';
import {
  TransactionRecord, TransactionList,
  PaymentRecord, PaymentList,
  PocketPayError, SDKConfig,
} from '../types';
import { validatePublicKey, wrapError } from '../utils';

/**
 * Fetches recent transactions for a Stellar account.
 *
 * @param publicKey - Stellar public key (G...)
 * @param limit - Max number of records (default: 10, max: 200)
 * @param order - Sort order (default: "desc" = newest first)
 * @param config - Optional SDK config overrides
 * @returns Paginated transaction list
 */
export async function getTransactions(
  publicKey: string,
  limit: number = 10,
  order: 'asc' | 'desc' = 'desc',
  config?: Partial<SDKConfig>
): Promise<TransactionList> {
  validatePublicKey(publicKey);
  const clampedLimit = Math.min(Math.max(1, limit), 200);

  try {
    const server = getHorizonServer(config);
    const page = await server
      .transactions()
      .forAccount(publicKey)
      .limit(clampedLimit)
      .order(order)
      .call();

    const records: TransactionRecord[] = page.records.map((tx: any) => ({
      hash: tx.hash,
      ledger: tx.ledger,
      createdAt: tx.created_at,
      sourceAccount: tx.source_account,
      fee: tx.fee_charged,
      operationCount: tx.operation_count,
      successful: tx.successful,
      memo: tx.memo || undefined,
      memoType: tx.memo_type,
    }));

    return { records, count: records.length };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      throw new PocketPayError(
        `Account not found: ${publicKey}`,
        'ACCOUNT_NOT_FOUND', 404
      );
    }
    throw wrapError(error, 'Failed to fetch transactions', 'TX_FETCH_ERROR');
  }
}

/**
 * Fetches recent payment operations for a Stellar account.
 *
 * @param publicKey - Stellar public key (G...)
 * @param limit - Max number of records (default: 10, max: 200)
 * @param order - Sort order (default: "desc" = newest first)
 * @param config - Optional SDK config overrides
 * @returns Paginated payment list
 */
export async function getPayments(
  publicKey: string,
  limit: number = 10,
  order: 'asc' | 'desc' = 'desc',
  config?: Partial<SDKConfig>
): Promise<PaymentList> {
  validatePublicKey(publicKey);
  const clampedLimit = Math.min(Math.max(1, limit), 200);

  try {
    const server = getHorizonServer(config);
    const page = await server
      .payments()
      .forAccount(publicKey)
      .limit(clampedLimit)
      .order(order)
      .call();

    const records: PaymentRecord[] = page.records
      .filter((op: any) =>
        ['payment', 'create_account', 'path_payment_strict_send', 'path_payment_strict_receive'].includes(op.type)
      )
      .map((op: any) => ({
        id: op.id,
        transactionHash: op.transaction_hash,
        type: op.type,
        createdAt: op.created_at,
        from: op.from || op.source_account || op.funder || '',
        to: op.to || op.account || '',
        amount: op.amount || op.starting_balance || '0',
        asset: op.asset_type === 'native' ? 'XLM' : (op.asset_code || 'XLM'),
        assetIssuer: op.asset_issuer || '',
      }));

    return { records, count: records.length };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      throw new PocketPayError(
        `Account not found: ${publicKey}`,
        'ACCOUNT_NOT_FOUND', 404
      );
    }
    throw wrapError(error, 'Failed to fetch payments', 'PAYMENTS_FETCH_ERROR');
  }
}
