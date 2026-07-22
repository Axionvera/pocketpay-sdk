# ADR 0003: Issued Asset Payment Trustline Validation Strategy

- **Status:** Proposed / Accepted
- **Date:** 2026-07-22
- **Deciders:** PocketPay SDK maintainers
- **Type:** Architecture / Security / Payments

## Context

On the Stellar network, sending native XLM requires only that the destination account exists on-chain. However, sending custom or issued assets (such as USDC, EURT, or project tokens) requires the receiving account to have established an explicit **trustline** (`ChangeTrust` operation) for the specific asset code and issuer public key combination.

Attempting to execute an issued asset payment to a destination account without a valid trustline results in delayed, confusing on-chain transaction failures (e.g. `op_no_destination`, `op_no_trust`, `op_not_authorized`, or `op_line_full`). Previously, the SDK lacked explicit helpers to perform pre-flight validation on destination trustlines, forcing consuming applications to either encounter cryptic Horizon submission errors or build custom trustline verification logic.

## Decision

The PocketPay SDK adopts a two-tiered (Local Pre-flight + Network Verification) strategy for issued asset payments and trustline validation:

### 1. Two-Tiered Validation Architecture

1. **Local Pre-flight Validation (Synchronous / Pure)**:
   - Validates asset code formatting (1–12 alphanumeric characters for credit assets).
   - Validates issuer public key formatting (`G...`).
   - Ensures native XLM assets (`code: "XLM"` or `code: "native"`) do not supply an issuer key.
   - Enforces valid positive decimal amounts and 28-byte text memo constraints.
   - Fast and free of network I/O; rejects malformed inputs immediately.

2. **Network Trustline Verification (Asynchronous / Horizon Query)**:
   - Fetches destination account data (`Horizon.Server.loadAccount`).
   - Checks if the destination account exists on-chain (handles 404 / unfunded state).
   - Searches destination balances for matching `asset_code` AND `asset_issuer`.
   - Verifies issuer authorization status (`is_authorized !== false` and `is_authorized_to_maintain_liabilities !== false`).
   - Calculates available trustline capacity (`limit - currentBalance`) and verifies it against the payment amount.

### 2. Error & Warning Taxonomy

The SDK defines a dedicated taxonomy of machine-readable error codes and recovery hints for trustline failures:

| Status Code | Error Code | Description | Recovery Hint Action |
| :--- | :--- | :--- | :--- |
| `native_xlm` | N/A | Native XLM requires no trustline check | N/A |
| `account_not_found` | `UNFUNDED_DESTINATION` | Recipient account does not exist on-chain | `fund_account` |
| `missing_trustline` | `MISSING_TRUSTLINE` | Recipient has no trustline for asset | `add_trustline` |
| `not_authorized` | `TRUSTLINE_NOT_AUTHORIZED` | Recipient trustline pending issuer authorization | `authorize_trustline` |
| `limit_exceeded` | `TRUSTLINE_LIMIT_EXCEEDED` | Payment amount exceeds remaining trustline capacity | `increase_trustline_limit` |

### 3. API Surface

The SDK exports the following trustline helpers under `src/payments/`:

- **`validateAssetSpec(asset: StellarAssetSpec): boolean`** — Pure local validation of asset code and issuer.
- **`checkDestinationTrustline(destination, asset, options?): Promise<TrustlineCheckResult>`** — Full network trustline verification.
- **`safeCheckDestinationTrustline(...)`** — Non-throwing variant returning `PocketPayResult<TrustlineCheckResult>`.
- **`verifyPaymentTrustlineOrThrow(...)`** — Helper that executes `checkDestinationTrustline` and throws a structured `PocketPayError` with recovery hints if invalid.

## Consequences

### Positive
- Prevents wasted network transaction submissions and gas/fees when sending issued assets to invalid recipients.
- Provides actionable diagnostic feedback and recovery hints to mobile/web UI consumers (e.g. telling the user "Recipient needs to add trustline for USDC" before submitting).
- Standardizes asset specification (`StellarAssetSpec`) across the SDK.

### Trade-offs / Limitations
- Pre-flight network trustline verification requires one extra HTTP GET call to Horizon prior to transaction submission. Consumers can opt in to pre-flight checking before payment execution.
- Race conditions remain theoretically possible if a recipient removes or modifies their trustline between the verification check and transaction ledger inclusion.

## References
- [Trustline Validation Guide](../trustline-validation.md)
- [Stellar Documentation on Trustlines](https://developers.stellar.org/docs/fundamentals/issuing-assets/trustlines)
