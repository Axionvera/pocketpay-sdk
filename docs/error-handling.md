# Error Handling Guide

This guide describes how to consistently catch, inspect, and handle errors thrown by the PocketPay SDK.

The SDK surfaces all application, validation, and network errors through the custom `PocketPayError` class. By understanding its structure and error codes, you can provide robust fallback behavior and clean user feedback.

---

## The `PocketPayError` Class

All errors thrown by the SDK's modules (Wallet, Payments, Transactions, and Soroban Vault) are instances of `PocketPayError`.

### Properties

| Property | Type | Description |
|:---|:---|:---|
| `message` | `string` | A human-readable description of the error (inherited from standard `Error`). |
| `code` | `string` | A machine-readable string identifier representing the specific error type. |
| `statusCode` | `number \| undefined` | The HTTP status code returned by the remote service (Horizon, Friendbot, etc.), if applicable. |
| `cause` | `Error \| undefined` | The original underlying error (e.g., Axios/Fetch error or Stellar SDK error) that triggered this error. |
| `transactionHash` | `string \| undefined` | The unique Stellar transaction hash related to the failure, if available. |
| `retryable` | `boolean \| undefined` | Set to `true` if the submission failed in a way that is safe to retry immediately. |

---

## Common Error Codes

Errors are grouped into four main categories based on where and why they occurred.

### 1. Input Validation Errors
These errors are thrown locally before any network requests are made.

*   `INVALID_PUBLIC_KEY`: The provided public key is not a valid Stellar address (must start with `G` and be 56 characters).
*   `INVALID_SECRET_KEY`: The provided secret key is not a valid Stellar private key (must start with `S` and be 56 characters).
*   `INVALID_AMOUNT`: The amount is not a positive number or is formatted incorrectly.
*   `INVALID_AMOUNT_PRECISION`: The amount exceeds the maximum Stellar precision of 7 decimal places (e.g., `1.12345678`).
*   `INVALID_MEMO`: The transaction memo text exceeds the Stellar limit of 28 bytes.
*   `SELF_PAYMENT`: The source account and destination account are identical.

### 2. Stellar Network & Horizon Errors
These errors occur during interactions with the Stellar Horizon network.

*   `ACCOUNT_NOT_FOUND` (HTTP 404): The requested public key has not been funded or created on the ledger yet.
*   `PAYMENT_FAILED` (HTTP 400): Stellar Core rejected the transaction. The error message will contain Horizon-specific transaction and operation result codes (e.g., `tx_insufficient_balance`, `op_no_destination`).
*   `TX_STATUS_UNKNOWN`: A submission timeout or network failure occurred. The transaction may or may not be confirmed in the ledger. Status polling is required before retrying.
*   `TX_EXPIRED`: The transaction was not found in the ledger and its `maxTime` bound has expired, indicating it is safe to rebuild and retry.
*   `SEND_ERROR`: A general failure occurred while building or submitting the payment transaction.
*   `TX_FETCH_ERROR`: Failed to query transaction history.
*   `PAYMENTS_FETCH_ERROR`: Failed to query payment operation history.
*   `BALANCE_ERROR`: Failed to retrieve the account balance.

### 3. Friendbot (Testnet Funding) Errors
These errors are specific to the testnet Friendbot service.

*   `TESTNET_ONLY`: Attempted to call `fundTestnetAccount` while configured for mainnet.
*   `FRIENDBOT_ERROR` (HTTP 400/404/500): Friendbot returned a non-2xx response. The `statusCode` property contains the HTTP response code.
*   `FUND_ERROR`: A network or system failure occurred while requesting funds.

### 4. Soroban Vault Errors
These errors are related to Smart Contract operations on the Soroban network.

*   `MISSING_CONTRACT_ID`: The Vault contract ID was not passed as a parameter and is missing from the `VAULT_CONTRACT_ID` environment variable.
*   `VAULT_DEPOSIT_ERROR`: Simulation or submission failed while depositing XLM into the vault.
*   `VAULT_WITHDRAW_ERROR`: Simulation or submission failed while withdrawing XLM from the vault.
*   `VAULT_BALANCE_ERROR`: Simulation failed while querying the vault balance.

---

## Implementation Patterns & Examples

### Basic Try/Catch Pattern
Always import `PocketPayError` to verify if a caught exception belongs to the SDK.

```typescript
import { sendXLM, PocketPayError } from '@axionvera/pocketpay-sdk';

async function executePayment() {
  try {
    const result = await sendXLM({
      sourceSecret: 'S...',
      destination: 'G...',
      amount: '10.50',
      memo: 'Invoice #104'
    });
    console.log('Payment successful! Hash:', result.hash);
  } catch (error) {
    if (error instanceof PocketPayError) {
      console.error(`SDK Error [${error.code}]: ${error.message}`);
    } else {
      console.error('Unknown application error:', error);
    }
  }
}
```

### Branching on Specific Error Codes
Use the `code` property to take action, correct inputs, or show helpful hints.

```typescript
import { getBalance, PocketPayError } from '@axionvera/pocketpay-sdk';

async function displayBalance(publicKey: string) {
  try {
    const balance = await getBalance(publicKey);
    return balance.nativeBalance;
  } catch (error) {
    if (error instanceof PocketPayError) {
      switch (error.code) {
        case 'INVALID_PUBLIC_KEY':
          showToast('Please enter a valid 56-character Stellar public key.');
          break;
        case 'ACCOUNT_NOT_FOUND':
          showToast('This account does not exist on the network. It needs to be funded to activate.');
          break;
        default:
          showToast('Failed to retrieve balance. Please try again later.');
      }
    }
  }
}
```

### Extracting Underlying Network/API Errors
If the error was caused by a lower-level HTTP client or library failure, inspect `error.cause`.

```typescript
import { fundTestnetAccount, PocketPayError } from '@axionvera/pocketpay-sdk';

async function fundAccount(publicKey: string) {
  try {
    await fundTestnetAccount(publicKey);
  } catch (error) {
    if (error instanceof PocketPayError) {
      if (error.code === 'FRIENDBOT_ERROR') {
        console.error(`Friendbot failed with status ${error.statusCode}`);
        // Read raw response details from the cause if necessary
        if (error.cause) {
          console.error('Underlying HTTP details:', error.cause.message);
        }
      }
    }
  }
}
```

---

## Safe User-Facing Messages

When building customer-facing interfaces, translate machine-readable SDK error codes into clear, friendly guidance. Avoid displaying raw stack traces or complex developer messages directly to the end user.

| Error Code | Best Practice User-Facing Message |
|:---|:---|
| `INVALID_PUBLIC_KEY` | "The Stellar address you entered is invalid. Make sure it starts with 'G'." |
| `INVALID_SECRET_KEY` | "The secret key is invalid. Please verify and try again." |
| `INVALID_AMOUNT` | "Please enter a positive numeric amount." |
| `INVALID_AMOUNT_PRECISION`| "Amounts cannot have more than 7 decimal places." |
| `INVALID_MEMO` | "Memo is too long. Please shorten it to 28 characters or fewer." |
| `SELF_PAYMENT` | "You cannot send payments to your own account." |
| `ACCOUNT_NOT_FOUND` | "This account is inactive. Fund it with XLM first to activate it." |
| `PAYMENT_FAILED` | "Transaction failed. Please ensure you have sufficient balance and network fees." |

---

## Security & Privacy: Do Not Log Secrets!

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT**
> 
> Never log raw error objects or arguments that contain secret keys, seed phrases, passwords, or personally identifiable information (PII). 

SDK errors may be caught in contexts where secrets are present in the local scope. When writing logging logic:

*   **DO NOT** serialize or log the entire local state, arguments, or raw requests.
*   **DO NOT** log `sourceSecret` or keypairs.
*   **DO** log only the safe, non-sensitive properties of `PocketPayError`:
    ```typescript
    // SAFE Logging Pattern
    logger.error('Payment failed', {
      errorCode: error.code,
      httpStatus: error.statusCode,
      errorMessage: error.message, // Checked to ensure no secrets are dynamically embedded
    });
    ```
*   Be cautious with `error.cause`. If the underlying HTTP library logs full request URLs containing query parameters or headers, sanitize them before writing to your logs.

---

## Enhanced Result Wrapper — Warnings & Recovery Hints

For operations where structured feedback is useful beyond a simple success/failure, the SDK provides an **enhanced result pattern** that adds optional `warnings` and `recoveryHints` arrays.

### Core Types

| Type | Description |
|:---|:---|
| `EnhancedSuccessResult<T>` | Success result with optional `warnings` and `recoveryHints`. |
| `EnhancedFailureResult` | Failure result with optional `warnings` and `recoveryHints`. |
| `EnhancedPocketPayResult<T>` | Discriminated union of the above two. |
| `ResultWarning` | A non-fatal diagnostic: `{ code, message, metadata? }`. |
| `RecoveryHint` | An actionable suggestion: `{ action, message, retryable?, suggestedDelayMs?, metadata? }`. |

### How It Works

The enhanced result is **structurally compatible** with the base `PocketPayResult<T>`. Code that checks `result.ok` continues to work unchanged — the extra fields are purely additive.

```typescript
import {
  enhancedSendXLM,
  enhancedGetBalance,
  type EnhancedPocketPayResult,
  type PaymentResult,
} from '@axionvera/pocketpay-sdk';

// enhancedSendXLM returns EnhancedPocketPayResult<PaymentResult>
const paymentResult = await enhancedSendXLM({
  sourceSecret: 'S...',
  destination: 'G...',
  amount: '10',
});

if (paymentResult.ok) {
  console.log('Payment hash:', paymentResult.value.hash);

  // Inspect non-fatal warnings
  if (paymentResult.warnings?.length) {
    paymentResult.warnings.forEach(w => console.warn(`[${w.code}] ${w.message}`));
  }
} else {
  console.error(paymentResult.error.code);

  // Act on recovery hints
  paymentResult.recoveryHints?.forEach(hint => {
    switch (hint.action) {
      case 'fund_account':
        showFundPrompt();
        break;
      case 'check_input':
        highlightInvalidFields();
        break;
      case 'retry':
        if (hint.retryable) scheduleRetry(hint.suggestedDelayMs ?? 3000);
        break;
    }
  });
}
```

### Pilot Operations

The enhanced pattern is currently applied to two pilot operations:

| Operation | Enhanced Wrapper | Warnings | Recovery Hints |
|:---|:---|:---|:---|
| `sendXLM` | `enhancedSendXLM` | `HIGH_FEE_RATIO` (fee > 10% of amount) | `fund_account`, `check_input`, `retry` |
| `getBalance` | `enhancedGetBalance` | `ZERO_NATIVE_BALANCE`, `MANY_ASSETS` (> 20) | `fund_account`, `check_network`, `check_input` |
| `importWallet` | `enhancedImportWallet` | None | `check_input` |

Each pilot also has a non-throwing variant: `safeEnhancedSendXLM`, `safeEnhancedGetBalance`, and `safeEnhancedImportWallet`.

### Building Your Own Enhanced Results

Use the helper functions to construct enriched results in custom code:

```typescript
import {
  toEnhancedSuccessResult,
  toEnhancedFailureResult,
  toEnhancedResult,
  PocketPayError,
} from '@axionvera/pocketpay-sdk';

// Manually construct
const success = toEnhancedSuccessResult(data, [
  { code: 'DEPRECATED', message: 'Field X is deprecated.' },
], [
  { action: 'retry', message: 'Try again.', retryable: true, suggestedDelayMs: 2000 },
]);

// Wrap an async function
const result = await toEnhancedResult(
  async () => doSomething(),
  {
    errorContext: 'Something failed',
    errorCode: 'MY_ERROR',
    warnings: [{ code: 'PARTIAL', message: 'Partial data returned.' }],
  },
);
```

### Recovery Hint Actions

| Action | Meaning |
|:---|:---|
| `retry` | The operation may succeed if retried (check `retryable` and `suggestedDelayMs`). |
| `fund_account` | The account needs to be funded with XLM before this operation can succeed. |
| `check_input` | One or more inputs need correction (check the `message` for details). |
| `check_network` | A network issue occurred; verify connectivity and retry. |
| `reduce_amount` | The requested amount exceeds available balance. |
| `contact_support` | The error is unexpected; escalate to support. |
