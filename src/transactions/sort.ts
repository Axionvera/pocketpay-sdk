/**
 * Stellar PocketPay SDK — Transaction Sorting Helpers
 *
 * Pure helpers for presenting transaction-like records in a predictable date
 * order without mutating data returned by Horizon or supplied by consumers.
 */

import type { SortableTransaction, TransactionSortOrder } from '../types';

function toTimestamp(value: SortableTransaction['createdAt']): number | null {
  if (value === undefined || value === null || value === '') return null;

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Returns a date-sorted copy of transaction-like records.
 *
 * Valid dates are ordered newest-first by default or oldest-first when
 * requested. Records with missing or invalid dates are retained at the end,
 * and records with equal dates preserve their original relative order.
 *
 * @param records - Transaction-like records to sort
 * @param order - `"newest"` (default) or `"oldest"`
 * @returns A new sorted array; the input array is never mutated
 */
export function sortTransactionsByDate<T extends SortableTransaction>(
  records: readonly T[],
  order: TransactionSortOrder = 'newest'
): T[] {
  if (order !== 'newest' && order !== 'oldest') {
    throw new RangeError(`Unsupported transaction sort order: ${String(order)}`);
  }

  const direction = order === 'oldest' ? 1 : -1;

  return records
    .map((record, index) => ({
      record,
      index,
      timestamp: toTimestamp(record.createdAt),
    }))
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.index - b.index;
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;

      const byDate = (a.timestamp - b.timestamp) * direction;
      return byDate === 0 ? a.index - b.index : byDate;
    })
    .map(({ record }) => record);
}
