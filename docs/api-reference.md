# API Reference: Pagination

This guide covers pagination for `getTransactions` and `getPayments` — the
two SDK helpers that return account history from Horizon.

> **Note on timestamps:** every `createdAt` field on records returned by
> these helpers is an ISO 8601 UTC string (e.g. `2026-07-18T14:32:11Z`).
> See [Transaction Date Formatting](./transaction-timestamps.md) for the
> full format spec and guidance on locale/timezone handling in your
> application.

Both helpers support cursor-based pagination so you can walk through an
account's full history instead of only ever seeing the most recent page.

## Two ways to call these helpers

### 1. Legacy positional arguments (still fully supported)

```typescript
import { getTransactions, getPayments } from 'stellar-pocketpay-sdk';

const transactions = await getTransactions(publicKey, 20, 'desc');
const payments = await getPayments(publicKey, 20, 'desc');
```

This form is unchanged and will keep working — no breaking changes.

### 2. Pagination-options object (new, recommended for paging)

```typescript
const page = await getTransactions(publicKey, { limit: 20, order: 'desc' });
```

The options object accepts:

| Option   | Type                 | Default  | Description                                  |
|----------|----------------------|----------|-----------------------------------------------|
| `limit`  | `number`             | `10`     | Max records to return (clamped to 1–200)      |
| `order`  | `'asc' \| 'desc'`    | `'desc'` | Sort order — `'desc'` is newest first         |
| `cursor` | `string`             | —        | Paging token to resume from                   |

## Walking through pages

Every result includes a `cursor` (the paging token of the last record in the
page) and a `hasMore` flag (true if the page came back full, suggesting
there may be more records beyond it):

```typescript
let cursor: string | undefined;
const allTransactions = [];

do {
  const page = await getTransactions(publicKey, { limit: 50, cursor });
  allTransactions.push(...page.records);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

console.log(`Fetched ${allTransactions.length} transactions total`);
```

The same pattern works for `getPayments`.

### Fetching a specific record's neighbors

Every individual record also carries its own `pagingToken`, so you can
resume from any specific record you already have, not just the last one in
a page:

```typescript
const page = await getTransactions(publicKey, { limit: 10 });
const someRecord = page.records[3];

const olderThanThatRecord = await getTransactions(publicKey, {
  limit: 10,
  cursor: someRecord.pagingToken,
});
```

## Notes

- `order: 'desc'` (the default) returns newest-first; passing the returned
  `cursor` back in fetches **older** records than what you already have.
- `order: 'asc'` returns oldest-first; passing the returned `cursor` back in
  fetches **newer** records.
- `hasMore: true` means the page was full and more records are *likely*
  available — it isn't a guarantee, since Horizon determines the actual data.
- These helpers only wrap Horizon's REST pagination; there's no local
  caching or persistence of pages.

## See also

- [Transaction Date Formatting](./transaction-timestamps.md) — format of
  every `createdAt` value these helpers return.
