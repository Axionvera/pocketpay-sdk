# Issued Asset Payments

This guide covers the full lifecycle of sending issued assets (e.g. USDC, EURT,
or custom tokens) using the PocketPay SDK.

---

## 1. Overview

Stellar supports two categories of payment:

| Payment type | Example | Trustline required? |
| :--- | :--- | :--- |
| **Native XLM** | `{ code: 'XLM' }` | No — only recipient account must exist on-chain |
| **Issued asset** | `{ code: 'USDC', issuer: 'GA5Z...' }` | Yes — recipient must hold an authorized trustline |

Both are sent through the same `sendAsset` function.  Passing
`asset: { code: 'XLM' }` is fully equivalent to calling `sendXLM` — no
behaviour changes.

---

## 2. Asset Identifiers

Every asset in the SDK is represented by a `StellarAssetSpec` object:

```ts
import type { StellarAssetSpec } from 'stellar-pocketpay-sdk';

// Native XLM — issuer must be absent or empty
const xlm: StellarAssetSpec = { code: 'XLM' };

// Issued asset — issuer is required and must be a valid G... public key
const usdc: StellarAssetSpec = {
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};
```

Asset code rules (enforced by `validateAssetSpec`):

- Native: `"XLM"` or `"native"` (case-insensitive). Must not have an issuer.
- Issued: 1–12 alphanumeric characters (`[a-zA-Z0-9]{1,12}`). Must include a
  valid `G...` issuer public key.

---

## 3. Trustline Prerequisites

Before a recipient can receive an issued asset they must submit a
`ChangeTrust` operation on their own account.  The SDK does not submit
`ChangeTrust` for you — that is the recipient's responsibility.

```
Recipient account:  ChangeTrust(asset: USDC:GA5Z..., limit: 1000)
```

If the asset issuer requires authorization (`AUTH_REQUIRED_FLAG` is set on the
issuing account), the issuer must also approve the trustline with an
`AllowTrust` or `SetTrustLineFlags` operation before the recipient can hold
the asset.

The SDK surfaces all of these conditions through structured errors rather than
letting them produce opaque Horizon result codes.

---

## 4. Sending an Issued Asset

### Basic usage

```ts
import { sendAsset } from 'stellar-pocketpay-sdk';

const result = await sendAsset({
  sourceSecret: senderSecretKey,     // S... secret key of the sender
  destination: receiverPublicKey,    // G... public key of the recipient
  amount: '50',                      // decimal string — '50' = 50 USDC
  asset: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
  memo: 'invoice #42',               // optional, max 28 bytes
});

console.log(result.hash);    // Stellar transaction hash
console.log(result.ledger);  // Ledger sequence number
console.log(result.asset);   // { code: 'USDC', issuer: 'GA5Z...' }
```

### Non-throwing variant

```ts
import { safeSendAsset } from 'stellar-pocketpay-sdk';

const result = await safeSendAsset({
  sourceSecret: senderSecretKey,
  destination: receiverPublicKey,
  amount: '50',
  asset: { code: 'USDC', issuer: usdcIssuer },
});

if (result.ok) {
  console.log('Sent!', result.value.hash);
} else {
  // result.error is a PocketPayError — never throws
  console.error(result.error.code, result.error.message);
}
```

### Native XLM via `sendAsset` (backward-compatible)

```ts
await sendAsset({
  sourceSecret: senderSecretKey,
  destination: receiverPublicKey,
  amount: '10',
  asset: { code: 'XLM' },   // native — no trustline check, behaves like sendXLM
});
```

---

## 5. Automatic Trustline Preflight

For issued assets `sendAsset` automatically runs `checkDestinationTrustline`
before building the transaction.  This catches the most common errors — missing
trustline, unauthorized trustline, and capacity exceeded — before any XLM fee
is spent.

The preflight adds one Horizon round-trip.  To skip it (e.g. if you have
already called `checkDestinationTrustline` yourself and the check passed):

```ts
await sendAsset({
  sourceSecret: senderSecretKey,
  destination: receiverPublicKey,
  amount: '50',
  asset: { code: 'USDC', issuer: usdcIssuer },
  skipTrustlineCheck: true,
});
```

> Only skip the check when you are certain the destination's trustline is valid
> for the amount being sent.  Submitting without a valid trustline wastes the
> base fee and fails on-chain with `op_no_trust` or `op_not_authorized`.

---

## 6. Manual Preflight (For UI Feedback)

Call `checkDestinationTrustline` explicitly when you want to show a detailed
message in your UI before the user confirms the payment:

```ts
import {
  checkDestinationTrustline,
  verifyPaymentTrustlineOrThrow,
} from 'stellar-pocketpay-sdk';

// Returns structured result — does not throw
const check = await checkDestinationTrustline(
  receiverPublicKey,
  { code: 'USDC', issuer: usdcIssuer },
  { amount: '50' },   // optional: validates capacity too
);

if (!check.valid) {
  switch (check.status) {
    case 'account_not_found':
      // receiver has never been funded
      break;
    case 'missing_trustline':
      // receiver has not added a USDC trustline yet
      break;
    case 'not_authorized':
      // trustline exists but issuer authorization is pending
      break;
    case 'limit_exceeded':
      // receiver only has `check.availableCapacity` remaining capacity
      break;
  }
}
```

Or use the throwing variant when you want a single try/catch guard:

```ts
// Throws PocketPayError if any trustline condition is not met
await verifyPaymentTrustlineOrThrow(
  receiverPublicKey,
  { code: 'USDC', issuer: usdcIssuer },
  { amount: '50' },
);
// If we reach here, the trustline is valid and has enough capacity
await sendAsset({ ..., skipTrustlineCheck: true });
```

---

## 7. Validation Rules

All validation runs synchronously before any network call:

| Input | Rule | Error code |
| :--- | :--- | :--- |
| `sourceSecret` | Valid Stellar secret key (`S...`) | `INVALID_SECRET_KEY` |
| `destination` | Valid Stellar public key (`G...`) | `INVALID_PUBLIC_KEY` |
| `amount` | Positive decimal string (`> 0`) | `INVALID_AMOUNT` |
| `memo` | ≤ 28 bytes (if provided) | `INVALID_MEMO` |
| `asset.code` | `XLM` / `native` for native; 1–12 alphanum for issued | `INVALID_ASSET_CODE` |
| `asset.issuer` | Required & valid `G...` for issued assets | `MISSING_ASSET_ISSUER` / `INVALID_PUBLIC_KEY` |
| Source ≠ Destination | Cannot send to yourself | `SELF_PAYMENT` |

---

## 8. Error Reference

All errors thrown by `sendAsset` (and surfaced by `safeSendAsset`) are
`PocketPayError` instances with a typed `.code` field.

| Code | Cause | Typical recovery |
| :--- | :--- | :--- |
| `INVALID_SECRET_KEY` | Malformed source secret key | Fix the key format |
| `INVALID_PUBLIC_KEY` | Malformed destination or issuer key | Fix the key format |
| `INVALID_AMOUNT` | Amount ≤ 0 or non-numeric | Use a positive decimal string |
| `INVALID_MEMO` | Memo exceeds 28 bytes | Shorten the memo |
| `INVALID_ASSET_CODE` | Asset code too long or contains symbols | 1–12 alphanumeric chars |
| `MISSING_ASSET_ISSUER` | Issued asset without issuer public key | Provide the issuer key |
| `INVALID_ASSET` | Native asset has a spurious issuer | Remove the `issuer` field |
| `SELF_PAYMENT` | Source and destination are the same | Use a different destination |
| `UNFUNDED_DESTINATION` | Destination account not on-chain | Fund the account first |
| `MISSING_TRUSTLINE` | Destination has no trustline for asset | Receiver must add a `ChangeTrust` |
| `TRUSTLINE_NOT_AUTHORIZED` | Trustline pending issuer authorization | Issuer must authorize the trustline |
| `TRUSTLINE_LIMIT_EXCEEDED` | Payment amount > available capacity | Reduce amount or receiver raises limit |
| `ACCOUNT_NOT_FOUND` | Source account not funded / not on-chain | Fund the source account |
| `PAYMENT_FAILED` | Horizon returned a transaction result code | Check `error.message` for the code |
| `SEND_ERROR` | Unexpected network or Horizon error | Retry or check the connection |
| `REQUEST_TIMEOUT` | Horizon request timed out | Retry after a delay |

---

## 9. `PaymentResult` Shape

A successful `sendAsset` call returns a `PaymentResult`:

```ts
interface PaymentResult {
  success: boolean;         // always true on success
  hash: string;             // Stellar transaction hash
  ledger: number;           // ledger sequence number
  fee: string;              // fee charged in stroops
  sourceAccount: string;    // sender public key
  destinationAccount: string; // recipient public key
  amount: string;           // amount sent
  createdAt: string;        // ISO 8601 UTC timestamp
  asset?: StellarAssetSpec; // asset sent (always present for sendAsset)
                            // undefined only for sendXLM (legacy compat)
}
```

---

## 10. Native XLM Compatibility

`sendXLM` is unchanged.  Existing code using `sendXLM` continues to work
without modification.  `sendAsset` with `asset: { code: 'XLM' }` is a
drop-in equivalent:

```ts
// These two calls are functionally identical
await sendXLM({ sourceSecret, destination, amount, memo });
await sendAsset({ sourceSecret, destination, amount, asset: { code: 'XLM' }, memo });
```

The only difference is that `sendAsset` always populates `result.asset`
(`{ code: 'XLM' }`) whereas `sendXLM` leaves the field undefined for
backward compatibility.

---

## 11. Complete API Exports

```ts
import {
  // Payment functions
  sendAsset,
  safeSendAsset,
  // Trustline helpers
  validateAssetSpec,
  checkDestinationTrustline,
  safeCheckDestinationTrustline,
  verifyPaymentTrustlineOrThrow,
  // Types
  type SendAssetParams,
  type PaymentResult,
  type StellarAssetSpec,
  type TrustlineCheckResult,
  type TrustlineCheckOptions,
  type TrustlineStatus,
} from 'stellar-pocketpay-sdk';
```

---

## 12. See Also

- [Trustline Validation Guide](./trustline-validation.md) — deep dive into
  trustline verification logic, status codes, and the two-tier local/network
  check design.
- [API Reference](./api-reference.md) — pagination and full parameter tables.
- [Error Handling](./error-handling.md) — SDK-wide error handling guide.
- [Getting Started](./getting-started.md) — first steps with wallets and XLM
  payments.
- [example: send-asset.ts](../examples/send-asset.ts) — runnable Testnet
  example showing the full issued-asset payment flow.
