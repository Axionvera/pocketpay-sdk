/**
 * Stellar PocketPay SDK — Transaction Filtering Helpers
 *
 * Lightweight, **pure** helper functions for filtering transaction and payment
 * summaries by direction, asset, date range, or counterparty. These helpers
 * perform no network calls and operate entirely on data already fetched via
 * {@link getTransactions} / {@link getPayments}. They are intended to power
 * client-side search and filter features (e.g. in the mobile app) without
 * re-implementing the same logic in every consumer.
 */

import { FilterableTransaction, TransactionDirection, FilterTransactionsOptions } from '../types';

// ─── Internal direction/counterparty resolution ──────────────────────────────

/**
 * Resolves the {@link TransactionDirection} of a record relative to a
 * reference account.
 *
 * Returns `null` when the reference account is not a party to the record
 * (e.g. a payment between two other accounts).
 */
function resolveDirection(
  record: FilterableTransaction,
  account: string
): TransactionDirection | null {
  const isPayment = record.from !== undefined || record.to !== undefined;

  if (isPayment) {
    const from = record.from;
    const to = record.to;
    if (from !== undefined && to !== undefined && from === to) return 'self';
    if (from === account) return 'outgoing';
    if (to === account) return 'incoming';
    return null;
  }

  // Transaction record: the source account is the originating party.
  if (record.sourceAccount === undefined) return null;
  if (record.sourceAccount === account) return 'outgoing';
  return 'incoming';
}

/**
 * Resolves the "other" account (the counterparty) of a record relative to a
 * reference account. Returns `null` when the reference account is not a party
 * to the record, or when no counterparty can be determined.
 */
function resolveCounterparty(
  record: FilterableTransaction,
  account: string
): string | null {
  const isPayment = record.from !== undefined || record.to !== undefined;

  if (isPayment) {
    if (record.from === account) return record.to ?? null;
    if (record.to === account) return record.from ?? null;
    return null;
  }

  // Transaction record: counterparty is the source account unless it is self.
  if (record.sourceAccount === undefined || record.sourceAccount === account) {
    return null;
  }
  return record.sourceAccount;
}

// ─── Direction ───────────────────────────────────────────────────────────────

/**
 * Filters records by their direction relative to a reference account.
 *
 * @param records - Transaction or payment summaries to filter
 * @param direction - `"incoming" | "outgoing" | "self"`
 * @param account - Reference Stellar account (G...) used to resolve direction
 * @returns A new array containing only matching records (input is not mutated)
 *
 * @example
 * ```ts
 * const incoming = filterByDirection(txs, 'incoming', myPublicKey);
 * ```
 */
export function filterByDirection<T extends FilterableTransaction>(
  records: T[],
  direction: TransactionDirection,
  account: string
): T[] {
  return records.filter((record) => resolveDirection(record, account) === direction);
}

// ─── Asset ───────────────────────────────────────────────────────────────────

/**
 * Filters records by asset code (and optionally issuer).
 *
 * Only records that actually carry asset data are considered — records
 * without an `asset` field (such as a raw {@link TransactionSummary}) are
 * excluded, matching the "where data exists" requirement.
 *
 * @param records - Transaction or payment summaries to filter
 * @param assetCode - Asset code to keep (e.g. `"XLM"`, `"USDC"`)
 * @param assetIssuer - Optional issuer to disambiguate issued assets
 * @returns A new array containing only matching records
 *
 * @example
 * ```ts
 * const usdc = filterByAsset(payments, 'USDC', 'GA5ZSE...KZVN');
 * ```
 */
export function filterByAsset<T extends FilterableTransaction>(
  records: T[],
  assetCode: string,
  assetIssuer?: string
): T[] {
  return records.filter((record) => {
    if (typeof record.asset !== 'string') return false;
    if (record.asset !== assetCode) return false;
    if (assetIssuer !== undefined && record.assetIssuer !== assetIssuer) return false;
    return true;
  });
}

// ─── Date range ──────────────────────────────────────────────────────────────

/**
 * Filters records by an inclusive `createdAt` date range.
 *
 * Either bound may be omitted to express a one-sided range. Records whose
 * `createdAt` cannot be parsed as a date are dropped.
 *
 * @param records - Transaction or payment summaries to filter
 * @param startDate - Keep records on or after this date (string or Date)
 * @param endDate - Keep records on or before this date (string or Date)
 * @returns A new array containing only in-range records
 *
 * @example
 * ```ts
 * const lastWeek = filterByDateRange(txs, '2024-01-01T00:00:00Z', '2024-01-07T23:59:59Z');
 * ```
 */
export function filterByDateRange<T extends FilterableTransaction>(
  records: T[],
  startDate?: string | Date,
  endDate?: string | Date
): T[] {
  const startMs = startDate !== undefined ? new Date(startDate).getTime() : undefined;
  const endMs = endDate !== undefined ? new Date(endDate).getTime() : undefined;

  return records.filter((record) => {
    const t = new Date(record.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    if (startMs !== undefined && t < startMs) return false;
    if (endMs !== undefined && t > endMs) return false;
    return true;
  });
}

// ─── Counterparty ──────────────────────────────────────────────────────────────

/**
 * Filters records by counterparty relative to a reference account.
 *
 * The counterparty is the "other" account on the record: the destination for
 * an outgoing payment, the source for an incoming payment, or the source
 * account for a transaction.
 *
 * @param records - Transaction or payment summaries to filter
 * @param counterparty - Stellar account (G...) to match as the counterparty
 * @param account - Reference account used to determine the counterparty
 * @returns A new array containing only records where the counterparty matches
 *
 * @example
 * ```ts
 * const withBob = filterByCounterparty(txs, bobPublicKey, myPublicKey);
 * ```
 */
export function filterByCounterparty<T extends FilterableTransaction>(
  records: T[],
  counterparty: string,
  account: string
): T[] {
  return records.filter(
    (record) => resolveCounterparty(record, account) === counterparty
  );
}

// ─── Combined helper ──────────────────────────────────────────────────────────

/**
 * Filters records by any combination of direction, asset, date range, and
 * counterparty in a single pass.
 *
 * Filters are applied in order (direction → asset → date range →
 * counterparty) and are all optional. The `direction` and `counterparty`
 * filters require `account`; if it is omitted those filters are skipped
 * rather than throwing, so callers can safely pass a partial options object.
 *
 * This helper performs no network calls and never mutates the input array.
 *
 * @param records - Transaction or payment summaries to filter
 * @param options - {@link FilterTransactionsOptions} describing the filters
 * @returns A new array containing only records matching every provided filter
 *
 * @example
 * ```ts
 * const result = filterTransactions(payments, {
 *   account: myPublicKey,
 *   direction: 'incoming',
 *   asset: 'USDC',
 *   startDate: '2024-01-01T00:00:00Z',
 * });
 * ```
 */
export function filterTransactions<T extends FilterableTransaction>(
  records: T[],
  options: FilterTransactionsOptions
): T[] {
  const { direction, account, asset, assetIssuer, startDate, endDate, counterparty } = options;

  let result = records;

  if (direction && account) {
    result = filterByDirection(result, direction, account);
  }
  if (asset) {
    result = filterByAsset(result, asset, assetIssuer);
  }
  if (startDate !== undefined || endDate !== undefined) {
    result = filterByDateRange(result, startDate, endDate);
  }
  if (counterparty && account) {
    result = filterByCounterparty(result, counterparty, account);
  }

  return result;
}
