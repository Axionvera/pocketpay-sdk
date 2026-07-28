# Payment receipts

A **receipt** is the display-facing projection of a payment attempt: the shape an
application renders on a confirmation screen, a history row, or a share sheet.
It is deliberately narrower than the SDK's internal result types.

```ts
import { buildPaymentReceipt, TransactionStatus } from 'stellar-pocketpay-sdk';

const receipt = buildPaymentReceipt(outcome, {
  network: 'testnet',
  amount: '10.5000000',
  asset: 'XLM',
  destination: recipientPublicKey,
});

if (receipt.status === TransactionStatus.COMPLETED) {
  showSuccess(receipt.explorerUrl);
}
```

## Why receipts exist

The SDK has two submission-side taxonomies, and **neither one covers the four
outcomes an application has to display**:

| Taxonomy | Values | Missing |
|---|---|---|
| `SubmissionOutcome` (`src/types/index.ts`) | `success`, `retryable_failure`, `non_retryable_failure`, `unknown_status` | no `pending` |
| `SorobanInvocationStatus` (`src/types/index.ts`) | `success`, `failed`, `simulation_error`, `error`, `pending` | no `unknown` |

`pending` is reachable only from the Soroban path and `unknown` only from the
classic one. Rather than introduce a third vocabulary, receipts reconcile both
into the existing public `TransactionStatus` enum
(`src/types/transaction.ts`), whose four members — `COMPLETED`, `PENDING`,
`FAILED`, `UNKNOWN` — map one to one onto what a screen needs to show.

## Status mapping

| Source | Value | `status` | `actionRequired` |
|---|---|---|---|
| `SubmissionOutcome` | `success` | `COMPLETED` | `none` |
| `SubmissionOutcome` | `retryable_failure` | `PENDING` | `retry` |
| `SubmissionOutcome` | `non_retryable_failure` | `FAILED` | `rebuild` |
| `SubmissionOutcome` | `unknown_status` | `UNKNOWN` | `poll` |
| `SorobanInvocationStatus` | `success` | `COMPLETED` | `none` |
| `SorobanInvocationStatus` | `pending` | `PENDING` | `poll` |
| `SorobanInvocationStatus` | `failed`, `error`, `simulation_error` | `FAILED` | `rebuild` |

### Two mappings that are easy to get wrong

**`unknown_status` is not a failure.** It is what a submission timeout or a
dropped connection classifies to, and the transaction may already have been
accepted by validators. A screen that renders it as "failed" tells someone their
payment did not happen when it may well have. The receipt maps it to `UNKNOWN`
and sets `actionRequired: 'poll'` so the application knows there is a real
answer to be fetched.

**`retryable_failure` is not a failure either.** The same signed envelope may
still be resubmitted, so the attempt is unresolved rather than rejected. It maps
to `PENDING` with `actionRequired: 'retry'`.

`actionRequired` exists precisely so a UI can distinguish "we do not know yet"
from "this is over".

## What a receipt never contains

Receipts carry a **safe failure summary** only:

```ts
failure?: { code: string; safeMessage: string };
```

Deliberately not propagated:

- the originating `PocketPayError` object, its `message` and its `cause`;
- `SorobanInvocationResult.error` — free-form text from the RPC node;
- `SorobanInvocationResult.rawResponse` — an unbounded payload.

`DIAGNOSTICS_SENSITIVE_KEYS` (`src/diagnostics/types.ts`) classifies `xdr`,
`envelope`, `signature` and `signedXDR` as always-redacted, and a receipt is the
surface an application is most likely to render, log or share verbatim. A test
walks the whole receipt graph and asserts that no key matches that list.

Consumers that need the full error already hold the SDK error object; the
receipt is not the place to carry it.

## Explorer links

`explorerUrl` is built with `getTransactionExplorerLink`
(`src/utils/explorer.ts`) and is present **only when both a transaction hash and
a network are known**. That is not always the case:

- `non_retryable_failure` never carries a hash;
- `unknown_status` carries `transactionHash?` — optional, because the hash may
  not have been observed before the connection dropped.

The network comes from the `network` option; when omitted, the resolved SDK
config is consulted. If neither is available the receipt is still produced,
without a link.

## Limitations

- **Receipts never throw.** They describe an attempt that already happened,
  including failed ones; throwing while building one would leave a consumer
  unable to render the outcome at all. A malformed hash yields a receipt without
  a link rather than an exception.
- **Contextual fields are pass-through.** `amount`, `asset`, `destination` and
  `memo` record what the caller asked for. The SDK does not re-read them from
  the network, so a receipt is not proof of what settled on-chain — for that,
  poll and rebuild the receipt from the confirmed outcome.
- **A receipt is a snapshot.** `createdAt` marks when it was built, not when the
  transaction was included in a ledger. A receipt with `status: UNKNOWN` stays
  unknown until the caller polls and builds a new one.

## API

| Export | Purpose |
|---|---|
| `buildPaymentReceipt(source, options?)` | Single entry point; accepts either taxonomy |
| `buildReceiptFromSubmission(outcome, options?)` | Classic Horizon submissions |
| `buildReceiptFromSoroban(result, options?)` | Soroban invocations and vault operations |
| `PaymentReceipt` | The receipt type |
| `PaymentReceiptOptions` | Display context, explorer network, clock injection |
| `ReceiptFailure` | Safe failure summary |
| `ReceiptSource`, `ReceiptAction` | Supporting unions |

`PaymentReceiptOptions.now` is a clock injection point so tests can assert a
deterministic `createdAt`.
