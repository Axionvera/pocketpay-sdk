# PocketPay SDK — Public Error Code & Taxonomy Standard

> Status: **Public contract**. Error codes and categories defined here are
> stable. Add new codes; never rename or renumber existing ones.

## Why

Historically, consumers had to parse human-readable error `message` strings to
understand failures. That is brittle: messages change, get localized, and can
leak secrets. This standard replaces that with:

- **Stable error codes** (`PocketPayError.code`) — branch on these.
- **Categories** (`PocketPayError.category`) — `WALLET`, `PAYMENT`,
  `TRANSACTION`, `NETWORK`, `SOROBAN`, `VAULT`, `SDK`.
- **Safe messages** (`PocketPayError.safeMessage`) — user-facing, never secret.
- **Metadata** (`ERROR_CODES`) — retryability + HTTP status + developer hints.
- **Redaction helpers** — strip secrets before logging.

## How to consume

```ts
import { PocketPayError, describeError, redactError, ErrorCategory } from 'stellar-pocketpay-sdk';

try {
  await sendAsset(params);
} catch (err) {
  if (err instanceof PocketPayError) {
    // Branch on the stable code, not the message string.
    switch (err.code) {
      case 'NET_RATE_LIMITED':
        await backOff();           // err.retryable === true
        break;
      case 'PAYMENT_SELF':
        showUser(err.safeMessage); // safe, no secrets
        break;
      default:
        // Always redact before logging.
        console.error(redactError(err));
    }
    // Or use the structured descriptor:
    const info = describeError(err.code);
    console.log(info.category, info.retryable, info.safeMessage);
  } else {
    console.error(redactError(err));
  }
}
```

### Retryability

- `err.retryable === true` (or `describeError(code).retryable`) means the
  operation is safe to retry (rate-limit, transient network, simulation).
- `TX_STATUS_UNKNOWN` means the outcome is **unknown** — poll status before
  deciding to rebuild or resubmit (it is *not* retryable as a blind resend).

## Categories

| Category | Prefix | Examples |
|---|---|---|
| Wallet | `WALLET_` | `WALLET_SECRET_EXPOSED`, `WALLET_ACCOUNT_UNFUNDED` |
| Payment | `PAYMENT_` | `PAYMENT_SELF`, `PAYMENT_TRUSTLINE_MISSING` |
| Transaction | `TX_` | `TX_EXPIRED`, `TX_FAILED`, `TX_STATUS_UNKNOWN` |
| Network | `NET_` | `NET_RATE_LIMITED`, `NET_TIMEOUT`, `NET_IDEMPOTENCY_CONFLICT` |
| Soroban | `SOROBAN_` | `SOROBAN_CONTRACT_ERROR`, `SOROBAN_RPC_UNAVAILABLE` |
| Vault | `VAULT_` | `VAULT_DEPOSIT_FAILED`, `VAULT_INSUFFICIENT_FUNDS` |
| SDK | `SDK_` | `SDK_CONFIG_INVALID`, `SDK_INTERNAL` |

The full registry (with `safeMessage`, `retryable`, `httpStatus`,
`developerHint`) lives in `src/errors/codes.ts` (`ERROR_CODES`).

## Redaction (mandatory before logging)

Never log raw `error.message` or `error.cause` — they may contain Stellar
secret keys (`S...`) or token material.

```ts
import { redactError, redactSensitive } from 'stellar-pocketpay-sdk';

console.error(redactError(err));                 // structured, redacted
console.error(redactSensitive(rawString));       // scrub a string
```

`classifySubmitError` already redacts secret material from raw submission
errors before attaching them to the returned `PocketPayError`.

## Migration notes

- **Before:** you may have branched on codes like `PAYMENT_FAILED` /
  `SEND_ERROR`. These are now mapped to the taxonomy (`TX_FAILED`,
  `NET_RATE_LIMITED`, `TX_STATUS_UNKNOWN`). Old codes still work as raw
  strings but are no longer the recommended contract.
- `PocketPayError` gained two **optional** fields — `category` and
  `safeMessage` — with no change to the existing constructor signature, so
  existing call sites are unaffected.
- Unknown codes fall back to `category: SDK` and a generic safe message, so
  consumers can always rely on `describeError()` returning a usable object.

## Extending the standard

1. Add the constant to `ErrorCode` in `src/errors/codes.ts`.
2. Add its `ErrorCodeSpec` to `ERROR_CODES` (category, retryable, safeMessage,
   developerHint).
3. Use the constant (not a string literal) wherever you throw.
4. Add a test in `tests/error-standard.test.ts`.
