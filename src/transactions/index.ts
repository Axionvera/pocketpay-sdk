/**
 * Stellar PocketPay SDK — Transactions Module
 *
 * Query transaction history and payment operations for a Stellar account.
 */

import { getHorizonServer } from '../config';
import {
  TransactionRecord, TransactionList,
  PaymentRecord, PaymentList,
  PaginationOptions,
  PocketPayError, SDKConfig,
} from '../types';
import { validatePublicKey, wrapError } from '../utils';

/**
 * Resolves the legacy positional-args overload and the new options-object
 * overload into a single normalized shape.
 */
function normalizePaginationArgs(
  limitOrOptions: number | PaginationOptions | undefined,
  orderOrConfig: 'asc' | 'desc' | Partial<SDKConfig> | undefined,
  maybeConfig: Partial<SDKConfig> | undefined
): { limit: number; order: 'asc' | 'desc'; cursor?: string; config?: Partial<SDKConfig> } {
  if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
    // New-style: getX(publicKey, { limit, order, cursor }, config?)
    return {
      limit: limitOrOptions.limit ?? 10,
      order: limitOrOptions.order ?? 'desc',
      cursor: limitOrOptions.cursor,
      config: orderOrConfig as Partial<SDKConfig> | undefined,
    };
  }

  // Legacy: getX(publicKey, limit?, order?, config?)
  return {
    limit: limitOrOptions ?? 10,
    order: (orderOrConfig as 'asc' | 'desc') ?? 'desc',
    cursor: undefined,
    config: maybeConfig,
  };
}

/**
 * Fetches recent transactions for a Stellar account.
 *
 * Supports both the legacy positional-args form and a pagination-options
 * object for cursor-based paging:
 *
 * ```typescript
 * // Legacy form (still works):
 * await getTransactions(publicKey, 20, 'desc');
 *
 * // Pagination-options form:
 * const page1 = await getTransactions(publicKey, { limit: 20 });
 * const page2 = await getTransactions(publicKey, { limit: 20, cursor: page1.cursor });
 * ```
 *
 * @param publicKey - Stellar public key (G...)
 * @param limitOrOptions - Either a max record count (legacy), or a {@link PaginationOptions} object
 * @param orderOrConfig - Sort order (legacy form), or SDK config overrides (options-object form)
 * @param maybeConfig - SDK config overrides (legacy form only)
 * @returns Paginated transaction list, including a `cursor` for fetching the next page
 */
export async function getTransactions(
  publicKey: string,
  limitOrOptions?: number | PaginationOptions,
  orderOrConfig?: 'asc' | 'desc' | Partial<SDKConfig>,
  maybeConfig?: Partial<SDKConfig>
): Promise<TransactionList> {
  validatePublicKey(publicKey);

  const { limit, order, cursor, config } = normalizePaginationArgs(
    limitOrOptions,
    orderOrConfig,
    maybeConfig
  );
  const clampedLimit = Math.min(Math.max(1, limit), 200);

  try {
    const server = getHorizonServer(config);
    let callBuilder = server
      .transactions()
      .forAccount(publicKey)
      .limit(clampedLimit)
      .order(order);

    if (cursor) {
      callBuilder = callBuilder.cursor(cursor);
    }

    const page = await callBuilder.call();

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
      pagingToken: tx.paging_token,
    }));

    const lastRecord = records[records.length - 1];

    return {
      records,
      count: records.length,
      cursor: lastRecord?.pagingToken,
      hasMore: records.length === clampedLimit,
    };
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
 * Supports both the legacy positional-args form and a pagination-options
 * object for cursor-based paging:
 *
 * ```typescript
 * // Legacy form (still works):
 * await getPayments(publicKey, 20, 'desc');
 *
 * // Pagination-options form:
 * const page1 = await getPayments(publicKey, { limit: 20 });
 * const page2 = await getPayments(publicKey, { limit: 20, cursor: page1.cursor });
 * ```
 *
 * @param publicKey - Stellar public key (G...)
 * @param limitOrOptions - Either a max record count (legacy), or a {@link PaginationOptions} object
 * @param orderOrConfig - Sort order (legacy form), or SDK config overrides (options-object form)
 * @param maybeConfig - SDK config overrides (legacy form only)
 * @returns Paginated payment list, including a `cursor` for fetching the next page
 */
export async function getPayments(
  publicKey: string,
  limitOrOptions?: number | PaginationOptions,
  orderOrConfig?: 'asc' | 'desc' | Partial<SDKConfig>,
  maybeConfig?: Partial<SDKConfig>
): Promise<PaymentList> {
  validatePublicKey(publicKey);

  const { limit, order, cursor, config } = normalizePaginationArgs(
    limitOrOptions,
    orderOrConfig,
    maybeConfig
  );
  const clampedLimit = Math.min(Math.max(1, limit), 200);

  try {
    const server = getHorizonServer(config);
    let callBuilder = server
      .payments()
      .forAccount(publicKey)
      .limit(clampedLimit)
      .order(order);

    if (cursor) {
      callBuilder = callBuilder.cursor(cursor);
    }

    const page = await callBuilder.call();

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
        pagingToken: op.paging_token,
      }));

    const lastRecord = records[records.length - 1];

    return {
      records,
      count: records.length,
      cursor: lastRecord?.pagingToken,
      hasMore: records.length === clampedLimit,
    };
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
