/**
 * Tests for the Transactions module — getTransactions / getPayments,
 * including cursor-based pagination support.
 *
 * The Horizon server is fully mocked (via ../src/config's getHorizonServer)
 * so these tests run deterministically and offline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTransactions, getPayments, PocketPayError } from '../src';
import { transactionList, paymentList } from './fixtures';

vi.mock('../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config')>();
  return {
    ...actual,
    getHorizonServer: vi.fn(),
  };
});

import { getHorizonServer } from '../src/config';

const TEST_PUBLIC_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

/** Builds a chainable Horizon CallBuilder mock that resolves to a page shaped
 *  like what @stellar/stellar-sdk's CallBuilder.call() actually returns
 *  (a flat `.records` array, not the raw HAL `_embedded.records` body). */
function makeCallBuilder(fixture: { _embedded: { records: unknown[] } } | { records: unknown[] }) {
  const page = '_embedded' in fixture ? { records: fixture._embedded.records } : fixture;
  const builder: any = {};
  builder.forAccount = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.cursor = vi.fn(() => builder);
  builder.call = vi.fn(() => Promise.resolve(page));
  return builder;
}

/** Builds a chainable CallBuilder mock whose .call() rejects (e.g. 404). */
function makeFailingCallBuilder(error: unknown) {
  const builder: any = {};
  builder.forAccount = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.cursor = vi.fn(() => builder);
  builder.call = vi.fn(() => Promise.reject(error));
  return builder;
}

describe('Transactions Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTransactions', () => {
    it('accepts the legacy positional (limit, order) form', async () => {
      const txBuilder = makeCallBuilder(transactionList);
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, 2, 'asc');

      expect(txBuilder.limit).toHaveBeenCalledWith(2);
      expect(txBuilder.order).toHaveBeenCalledWith('asc');
      expect(txBuilder.cursor).not.toHaveBeenCalled();
      expect(result.records).toHaveLength(2);
    });

    it('accepts a pagination-options object', async () => {
      const txBuilder = makeCallBuilder(transactionList);
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, { limit: 2, order: 'desc', cursor: '123456789' });

      expect(txBuilder.limit).toHaveBeenCalledWith(2);
      expect(txBuilder.order).toHaveBeenCalledWith('desc');
      expect(txBuilder.cursor).toHaveBeenCalledWith('123456789');
      expect(result.records).toHaveLength(2);
    });

    it('does not call .cursor() when no cursor is provided', async () => {
      const txBuilder = makeCallBuilder(transactionList);
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      await getTransactions(TEST_PUBLIC_KEY, { limit: 10 });

      expect(txBuilder.cursor).not.toHaveBeenCalled();
    });

    it('returns older records via cursor (paging_token) mapped from each record', async () => {
      const txBuilder = makeCallBuilder(transactionList);
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, { limit: 2 });

      expect(result.records[0].pagingToken).toBe('123456789');
      expect(result.records[1].pagingToken).toBe('123456790');
      // cursor should be the paging token of the last record in the page,
      // ready to be passed back in to fetch the next page.
      expect(result.cursor).toBe('123456790');
    });

    it('sets hasMore: true when the page is full', async () => {
      const txBuilder = makeCallBuilder(transactionList); // 2 fixture records
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, { limit: 2 });

      expect(result.hasMore).toBe(true);
    });

    it('sets hasMore: false when the page is not full', async () => {
      const txBuilder = makeCallBuilder(transactionList); // 2 fixture records
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, { limit: 10 });

      expect(result.hasMore).toBe(false);
    });

    it('returns cursor: undefined and hasMore: false when there are no records', async () => {
      const emptyBuilder = makeCallBuilder({ _embedded: { records: [] } });
      (getHorizonServer as any).mockReturnValue({ transactions: () => emptyBuilder });

      const result = await getTransactions(TEST_PUBLIC_KEY, { limit: 10 });

      expect(result.records).toHaveLength(0);
      expect(result.cursor).toBeUndefined();
      expect(result.hasMore).toBe(false);
    });

    it('clamps limit to 200 and to a minimum of 1', async () => {
      const txBuilder = makeCallBuilder(transactionList);
      (getHorizonServer as any).mockReturnValue({ transactions: () => txBuilder });

      await getTransactions(TEST_PUBLIC_KEY, { limit: 999 });
      expect(txBuilder.limit).toHaveBeenCalledWith(200);

      await getTransactions(TEST_PUBLIC_KEY, { limit: -5 });
      expect(txBuilder.limit).toHaveBeenCalledWith(1);
    });

    it('throws ACCOUNT_NOT_FOUND for a 404 response', async () => {
      const failingBuilder = makeFailingCallBuilder({ response: { status: 404 } });
      (getHorizonServer as any).mockReturnValue({ transactions: () => failingBuilder });

      await expect(getTransactions(TEST_PUBLIC_KEY)).rejects.toThrow(PocketPayError);
      await expect(getTransactions(TEST_PUBLIC_KEY)).rejects.toThrow(/Account not found/);
    });

    it('rejects an invalid public key before hitting the network', async () => {
      await expect(getTransactions('NOT-A-KEY')).rejects.toThrow(PocketPayError);
    });
  });

  describe('getPayments', () => {
    it('accepts the legacy positional (limit, order) form', async () => {
      const payBuilder = makeCallBuilder(paymentList);
      (getHorizonServer as any).mockReturnValue({ payments: () => payBuilder });

      const result = await getPayments(TEST_PUBLIC_KEY, 2, 'asc');

      expect(payBuilder.limit).toHaveBeenCalledWith(2);
      expect(payBuilder.order).toHaveBeenCalledWith('asc');
      expect(payBuilder.cursor).not.toHaveBeenCalled();
      expect(result.records).toHaveLength(2);
    });

    it('accepts a pagination-options object with a cursor', async () => {
      const payBuilder = makeCallBuilder(paymentList);
      (getHorizonServer as any).mockReturnValue({ payments: () => payBuilder });

      const result = await getPayments(TEST_PUBLIC_KEY, { limit: 2, cursor: '987654321' });

      expect(payBuilder.cursor).toHaveBeenCalledWith('987654321');
      expect(result.records).toHaveLength(2);
    });

    it('maps paging_token onto each record and derives the next cursor', async () => {
      const payBuilder = makeCallBuilder(paymentList);
      (getHorizonServer as any).mockReturnValue({ payments: () => payBuilder });

      const result = await getPayments(TEST_PUBLIC_KEY, { limit: 2 });

      expect(result.records[0].pagingToken).toBe('987654321');
      expect(result.records[1].pagingToken).toBe('987654322');
      expect(result.cursor).toBe('987654322');
    });

    it('sets hasMore based on whether the page was full', async () => {
      const payBuilder = makeCallBuilder(paymentList); // 2 fixture records
      (getHorizonServer as any).mockReturnValue({ payments: () => payBuilder });

      const full = await getPayments(TEST_PUBLIC_KEY, { limit: 2 });
      expect(full.hasMore).toBe(true);

      const notFull = await getPayments(TEST_PUBLIC_KEY, { limit: 50 });
      expect(notFull.hasMore).toBe(false);
    });

    it('throws ACCOUNT_NOT_FOUND for a 404 response', async () => {
      const failingBuilder = makeFailingCallBuilder({ response: { status: 404 } });
      (getHorizonServer as any).mockReturnValue({ payments: () => failingBuilder });

      await expect(getPayments(TEST_PUBLIC_KEY)).rejects.toThrow(PocketPayError);
    });

    it('rejects an invalid public key before hitting the network', async () => {
      await expect(getPayments('NOT-A-KEY')).rejects.toThrow(PocketPayError);
    });
  });
});
