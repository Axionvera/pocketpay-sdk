# Add transaction filtering helper utilities

## Summary

This PR adds lightweight, **pure** helper functions for filtering transaction and
payment summaries by direction, asset, date range, and counterparty. They are
intended to remove the need for every consumer (especially the mobile app) to
re-implement the same filtering logic against data already fetched from
`getTransactions` / `getPayments`.

Resolves: issue #111

## Motivation

Apps frequently need to search and filter transaction history (incoming vs
outgoing, by asset, by date, by counterparty). Until now each consumer had to
write its own filtering. The SDK now ships small, composable, network-free
helpers so this behaviour is consistent and tested in one place.

## What changed

### New file: `src/transactions/filter.ts`

Five pure functions, none of which perform network calls:

- `filterByDirection(records, direction, account)` — keeps records matching a
  `TransactionDirection` (`'incoming' | 'outgoing' | 'self'`) relative to a
  reference account. Works for both `TransactionSummary` and `PaymentSummary`.
- `filterByAsset(records, assetCode, assetIssuer?)` — keeps records for a given
  asset. Only records that actually carry asset data are considered (e.g. a raw
  `TransactionSummary` has no `asset` and is excluded), satisfying the
  "where data exists" requirement.
- `filterByDateRange(records, startDate?, endDate?)` — inclusive `createdAt`
  range filter; either bound may be omitted. Records with unparseable dates are
  dropped.
- `filterByCounterparty(records, counterparty, account)` — keeps records whose
  "other" party (destination for outgoing, source for incoming, or the source
  account of a transaction) equals `counterparty`.
- `filterTransactions(records, options)` — combined entrypoint that applies any
  combination of the above in a single pass. `direction` and `counterparty`
  require `account`; if it is omitted those filters are skipped rather than
  throwing.

All helpers return **new arrays** and never mutate the input.

### Types: `src/types/index.ts`

- `TransactionDirection` — `'incoming' | 'outgoing' | 'self'`.
- `FilterableTransaction` — structural shape shared by `TransactionSummary` and
  `PaymentSummary` that the helpers operate on (all fields except `createdAt`
  optional, so the same helpers work across both record types).
- `FilterTransactionsOptions` — options object for `filterTransactions`.

### Exports

- Re-exported from `src/transactions/index.ts` and the package root
  `src/index.ts` (both functions and the new types).
- `tests/exports.test.ts` updated to assert the new public exports.

## Usage

```ts
import { getPayments, filterTransactions } from 'stellar-pocketpay-sdk';

const { records } = await getPayments(myPublicKey);

// Combined filter: incoming USDC received in January 2024
const incomingUsdc = filterTransactions(records, {
  account: myPublicKey,
  direction: 'incoming',
  asset: 'USDC',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
});

// Or use the smaller helpers individually
import { filterByDirection, filterByAsset, filterByDateRange } from 'stellar-pocketpay-sdk';
const outgoing = filterByDirection(records, 'outgoing', myPublicKey);
```

## Acceptance criteria

- [x] Transaction filtering helper exists (`filterTransactions` + smaller helpers).
- [x] Filter by direction is supported (`filterByDirection`).
- [x] Filter by asset is supported where data exists (`filterByAsset`).
- [x] Filter by date range is supported (`filterByDateRange`).
- [x] Helper is pure and does not perform network calls.
- [x] Tests cover common filter cases (see `tests/filterTransactions.test.ts`).

## Files affected

- `src/transactions/filter.ts` (new)
- `src/transactions/index.ts`
- `src/types/index.ts`
- `src/index.ts`
- `tests/filterTransactions.test.ts` (new)
- `tests/exports.test.ts`

## Testing

- `npm run lint` — passes (no type errors).
- `npm run test` — all suites pass, including the new
  `tests/filterTransactions.test.ts` covering direction, asset, date range,
  counterparty, combined filtering, no-mutation, and no-input-mutation cases.

This can support mobile search and filter features later.

closes #111
