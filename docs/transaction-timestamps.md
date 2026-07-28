# Transaction Date Formatting Guidance

This guide documents how the SDK returns transaction and payment timestamps,
and what consuming applications are responsible for handling themselves.

It applies to every timestamp surfaced by the SDK's history helpers, including
the `createdAt` field on `TransactionSummary`, `PaymentSummary`, and the
`PaymentResult` returned by `sendXLM`.

## Format

All timestamps returned by the SDK are **ISO 8601 strings in UTC** (with a
trailing `Z`). The SDK does not parse, re-format, or apply any timezone
offset to the underlying Horizon response — it passes the value through
verbatim from `created_at`.

The TypeScript type for every timestamp field is `string`, and the value will
always be parseable by `new Date(...)` in any JavaScript runtime.

### Example value

```text
2026-07-18T14:32:11Z
```

A real `getTransactions` / `getPayments` record will look like this:

```typescript
{
  hash: "9f3a1c8b4e2d7f6a5b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
  ledger: 512304,
  createdAt: "2026-07-18T14:32:11Z",
  sourceAccount: "GABC...XYZ",
  // ... other fields
}
```

## UTC, no offsets

The `Z` suffix means **UTC / "Zulu time"**. There is no local-time component
in the string, and the SDK never returns an offset value (e.g. `+02:00` or
`-05:00`).

If you need the value in another timezone, convert it in your application
code — the SDK will not do that for you. Examples:

```typescript
// Parse to a Date, then format in the consumer's locale
const txDate = new Date(tx.createdAt);
const localString = txDate.toLocaleString();

// Convert to a specific timezone (e.g. America/New_York)
const nyString = txDate.toLocaleString('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Render relative time (e.g. "3 minutes ago")
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  .format(
    Math.round((txDate.getTime() - Date.now()) / 60_000),
    'minute'
  );
```

## What belongs in the consuming app

The SDK deliberately keeps timestamp output predictable and unopinionated so
that every consuming application can render dates the way its own users
expect. The following are **not** the SDK's responsibility:

- **Locale-specific formatting** (e.g. "Jul 18, 2026" vs "18/07/2026")
- **Timezone conversion** to the user's local timezone
- **Relative time strings** ("3 minutes ago", "yesterday")
- **Calendar-system conversion** (Hijri, Buddhist, Japanese, etc.)
- **Date-input parsing** from user-typed strings

Reach for `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, or a dedicated
date library (`date-fns`, `dayjs`, `luxon`) in your application code.

## Why the SDK does not format dates

Adding locale-aware formatting inside the SDK would force every consumer —
mobile apps, server-side jobs, CLI scripts — through the same default
format. Some consumers want ISO strings; others want a `Date` object; others
want a localized string in a non-default locale. By returning a stable
ISO 8601 string, the SDK keeps its output predictable and lets each
consumer render dates however it needs.

## Related

- [API Reference](./api-reference.md) — full reference for `getTransactions`
  and `getPayments`
- [Getting Started](./getting-started.md) — example of reading transaction
  history
