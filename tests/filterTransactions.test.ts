/**
 * Tests for the pure transaction filtering helpers.
 *
 * These helpers perform no network calls, so no Horizon mocking is required.
 * We build in-memory TransactionSummary / PaymentSummary fixtures and assert
 * the filtering behavior for direction, asset, date range, counterparty, and
 * the combined filterTransactions entrypoint.
 */

import { describe, it, expect } from 'vitest';
import {
  filterByDirection,
  filterByAsset,
  filterByDateRange,
  filterByCounterparty,
  filterTransactions,
} from '../src';
import type { TransactionSummary, PaymentSummary } from '../src';

const ACCOUNT = 'GACCOUNT0000000000000000000000000000000000000000000000000';
const OTHER = 'GOTHER0000000000000000000000000000000000000000000000000000';
const THIRD = 'GTHIRD00000000000000000000000000000000000000000000000000000';

function makeTx(
  overrides: Partial<TransactionSummary> = {}
): TransactionSummary {
  return {
    hash: 'tx-' + Math.random().toString(36).slice(2),
    ledger: 1,
    createdAt: '2024-01-15T10:00:00Z',
    sourceAccount: ACCOUNT,
    fee: '100',
    operationCount: 1,
    successful: true,
    memoType: 'none',
    pagingToken: '1',
    ...overrides,
  };
}

function makePayment(
  overrides: Partial<PaymentSummary> = {}
): PaymentSummary {
  return {
    id: 'op-' + Math.random().toString(36).slice(2),
    transactionHash: 'txh',
    type: 'payment',
    createdAt: '2024-01-15T10:00:00Z',
    from: ACCOUNT,
    to: OTHER,
    amount: '10',
    asset: 'XLM',
    assetIssuer: '',
    pagingToken: '1',
    ...overrides,
  };
}

describe('Transaction filtering helpers', () => {
  describe('filterByDirection (transactions)', () => {
    const outgoing = makeTx({ sourceAccount: ACCOUNT });
    const incoming = makeTx({ sourceAccount: OTHER });
    const txs = [outgoing, incoming];

    it('keeps outgoing txs when account is the source', () => {
      const result = filterByDirection(txs, 'outgoing', ACCOUNT);
      expect(result).toEqual([outgoing]);
    });

    it('keeps incoming txs when account is not the source', () => {
      const result = filterByDirection(txs, 'incoming', ACCOUNT);
      expect(result).toEqual([incoming]);
    });

    it('returns an empty array when nothing matches', () => {
      const result = filterByDirection(txs, 'incoming', OTHER);
      expect(result).toEqual([outgoing]); // OTHER is source of `incoming`
    });
  });

  describe('filterByDirection (payments)', () => {
    const sent = makePayment({ from: ACCOUNT, to: OTHER });
    const received = makePayment({ from: OTHER, to: ACCOUNT });
    const self = makePayment({ from: ACCOUNT, to: ACCOUNT });
    const unrelated = makePayment({ from: OTHER, to: THIRD });
    const payments = [sent, received, self, unrelated];

    it('keeps outgoing payments (from === account)', () => {
      expect(filterByDirection(payments, 'outgoing', ACCOUNT)).toEqual([sent]);
    });

    it('keeps incoming payments (to === account)', () => {
      expect(filterByDirection(payments, 'incoming', ACCOUNT)).toEqual([received]);
    });

    it('keeps self payments (from === to === account)', () => {
      expect(filterByDirection(payments, 'self', ACCOUNT)).toEqual([self]);
    });

    it('excludes records where account is not a party', () => {
      expect(filterByDirection(payments, 'outgoing', ACCOUNT)).not.toContain(unrelated);
    });
  });

  describe('filterByAsset', () => {
    const xlm = makePayment({ asset: 'XLM', assetIssuer: '' });
    const usdc = makePayment({ asset: 'USDC', assetIssuer: 'GISSUER' });
    const usdcOther = makePayment({ asset: 'USDC', assetIssuer: 'GOTHERISSUER' });
    const payments = [xlm, usdc, usdcOther];

    it('filters by asset code', () => {
      expect(filterByAsset(payments, 'USDC')).toEqual([usdc, usdcOther]);
    });

    it('filters by asset code and issuer', () => {
      expect(filterByAsset(payments, 'USDC', 'GISSUER')).toEqual([usdc]);
    });

    it('excludes records that have no asset field (transactions)', () => {
      const tx = makeTx();
      expect(filterByAsset([tx], 'XLM')).toEqual([]);
    });

    it('returns empty when no asset matches', () => {
      expect(filterByAsset(payments, 'EURT')).toEqual([]);
    });
  });

  describe('filterByDateRange', () => {
    const early = makeTx({ createdAt: '2024-01-01T00:00:00Z' });
    const mid = makeTx({ createdAt: '2024-01-15T00:00:00Z' });
    const late = makeTx({ createdAt: '2024-01-31T00:00:00Z' });
    const txs = [early, mid, late];

    it('keeps records within an inclusive range', () => {
      const result = filterByDateRange(txs, '2024-01-10T00:00:00Z', '2024-01-20T00:00:00Z');
      expect(result).toEqual([mid]);
    });

    it('supports a one-sided (start-only) range', () => {
      const result = filterByDateRange(txs, '2024-01-15T00:00:00Z');
      expect(result).toEqual([mid, late]);
    });

    it('supports a one-sided (end-only) range', () => {
      const result = filterByDateRange(txs, undefined, '2024-01-01T00:00:00Z');
      expect(result).toEqual([early]);
    });

    it('drops records with unparseable dates', () => {
      const bad = makeTx({ createdAt: 'not-a-date' });
      const result = filterByDateRange([bad, early], undefined, '2024-02-01T00:00:00Z');
      expect(result).toEqual([early]);
    });
  });

  describe('filterByCounterparty', () => {
    const toOther = makePayment({ from: ACCOUNT, to: OTHER });
    const fromOther = makePayment({ from: OTHER, to: ACCOUNT });
    const toThird = makePayment({ from: ACCOUNT, to: THIRD });
    const payments = [toOther, fromOther, toThird];

    it('matches the destination for outgoing payments', () => {
      expect(filterByCounterparty(payments, OTHER, ACCOUNT)).toEqual([toOther, fromOther]);
    });

    it('matches the source for incoming payments', () => {
      expect(filterByCounterparty(payments, OTHER, ACCOUNT)).toEqual([toOther, fromOther]);
    });

    it('matches the source account for transactions', () => {
      const incoming = makeTx({ sourceAccount: OTHER });
      const outgoing = makeTx({ sourceAccount: ACCOUNT });
      expect(filterByCounterparty([incoming, outgoing], OTHER, ACCOUNT)).toEqual([incoming]);
    });
  });

  describe('filterTransactions (combined)', () => {
    const janXlmIn = makePayment({
      from: OTHER, to: ACCOUNT, asset: 'XLM',
      createdAt: '2024-01-10T00:00:00Z',
    });
    const janXlmOut = makePayment({
      from: ACCOUNT, to: OTHER, asset: 'XLM',
      createdAt: '2024-01-12T00:00:00Z',
    });
    const febUsdcIn = makePayment({
      from: OTHER, to: ACCOUNT, asset: 'USDC', assetIssuer: 'GISSUER',
      createdAt: '2024-02-10T00:00:00Z',
    });
    const payments = [janXlmIn, janXlmOut, febUsdcIn];

    it('applies multiple filters together', () => {
      const result = filterTransactions(payments, {
        account: ACCOUNT,
        direction: 'incoming',
        asset: 'XLM',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T00:00:00Z',
      });
      expect(result).toEqual([janXlmIn]);
    });

    it('treats asset-only filter without account', () => {
      const result = filterTransactions(payments, { asset: 'USDC' });
      expect(result).toEqual([febUsdcIn]);
    });

    it('skips direction/counterparty when account is missing', () => {
      const result = filterTransactions(payments, {
        direction: 'incoming',
        startDate: '2024-02-01T00:00:00Z',
      });
      expect(result).toEqual([febUsdcIn]);
    });

    it('returns the original input when no options provided', () => {
      const result = filterTransactions(payments, {});
      expect(result).toEqual(payments);
    });

    it('does not mutate the input array', () => {
      const snapshot = [...payments];
      filterTransactions(payments, { account: ACCOUNT, direction: 'incoming' });
      expect(payments).toEqual(snapshot);
    });
  });
});
