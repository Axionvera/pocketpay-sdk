# Transaction Timeout Classification

Not every timeout means the same thing. A timeout while reading an account is
harmless — nothing was sent. A timeout while submitting a payment is not: the
transaction may already be on-chain, and resubmitting could pay twice.

The SDK reports which stage a timeout interrupted, so consumers can pick a
recovery action instead of guessing.

## Stages

| Stage | When it happens | Was anything sent? | Code reported |
| --- | --- | --- | --- |
| `preparation` | Account lookups, contract simulation | No | `REQUEST_TIMEOUT` |
| `submission` | Sending the transaction to Horizon or Soroban | **Maybe** | `TX_STATUS_UNKNOWN` |
| `confirmation` | Polling for the final status | **Yes** | `TX_STATUS_UNKNOWN` |
| `unknown` | Stage could not be determined (plain reads) | Unclear | `REQUEST_TIMEOUT` |

Every timeout carries the stage on the error:

```ts
try {
  await sendXLM(params);
} catch (error) {
  if (error instanceof PocketPayError && error.timeout) {
    error.timeout.stage;     // 'submission'
    error.timeout.operation; // 'Horizon transaction submission'
    error.timeout.timeoutMs; // 30000
  }
}
```

## Recovery behaviour

### Preparation and unknown → safe to retry

Nothing reached the network, so there is nothing to duplicate. Retry with
backoff, or raise `timeout` in the SDK config.

```ts
if (error.timeout?.stage === 'preparation') {
  await sendXLM(params); // safe
}
```

### Submission and confirmation → check status first

The outcome is genuinely undetermined. These are reported as
`TX_STATUS_UNKNOWN`, which `isUnknownStatusError()` recognises:

```ts
import { isUnknownStatusError, submitTransactionIdempotently } from 'stellar-pocketpay-sdk';

if (isUnknownStatusError(error)) {
  // Poll before deciding. Never resubmit blindly.
  const record = await pollTransactionStatus(transaction);
}
```

`sendXLM` and `sendAsset` attach a `check_status` recovery hint with
`retryable: false` for these, instead of the `retry` hint used for ordinary
network trouble.

## Why not NET_TIMEOUT

`NET_TIMEOUT` is `retryable: true`. Mapping a submission timeout to it would
tell consumers — and any automated retry layer reading `retryable` — that
resending the same payment is safe. It is not: the payment may already have
settled. `TX_STATUS_UNKNOWN` is `retryable: false` precisely so that automation
stops and polls.

| Code | `retryable` | Meaning |
| --- | --- | --- |
| `REQUEST_TIMEOUT` | `true` | An SDK timeout elapsed before anything was sent. |
| `NET_TIMEOUT` | `true` | A transport-level timeout on a plain request. |
| `TX_STATUS_UNKNOWN` | `false` | Sent, outcome undetermined — poll, do not resend. |

## How the stage is determined

Every timeout flows through `withTimeout(operation, timeoutMs, request, stage?)`
in `src/network/index.ts`. The `operation` label was always there; it is now
also used to classify the timeout rather than only appearing in the message.

`inferTimeoutStage(operation)` maps the label, and any call site may state its
stage explicitly as the fourth argument, which always wins:

```ts
await withTimeout('Horizon transaction submission', cfg.timeout, promise, 'submission');
```

## Compatibility

- `REQUEST_TIMEOUT` keeps its exact code string and message format, and is now
  part of the published registry — `isKnownErrorCode()` recognises it and
  `describeError()` returns real guidance instead of the unknown-code fallback.
- `error.timeout` is a new optional field; nothing existing reads it.
- **Behaviour change:** submission and confirmation timeouts now report
  `TX_STATUS_UNKNOWN` instead of `REQUEST_TIMEOUT`. Consumers branching on
  `REQUEST_TIMEOUT` for those two stages should use `isUnknownStatusError()`.
  Preparation and plain-read timeouts are unchanged.

## See also

- [Retry Policy](./retry-policy.md) — retrying what is genuinely retryable.
- [Idempotency](./idempotency.md) — avoiding duplicate submissions.
- [Network Errors](./network-errors.md) — the wider network error surface.
- [Error Standard](./error-standard.md) — the published error code registry.
