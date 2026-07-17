# Error Handling

PocketPay SDK provides two complementary error-handling styles. You can mix them freely — choose whichever suits each call site.

---

## Style 1 — Thrown errors (existing behaviour)

Every core SDK function throws a `PocketPayError` on failure. This is the default and requires no migration.

```ts
import { getBalance, PocketPayError } from '@axionvera/pocketpay-sdk';

try {
  const balance = await getBalance(publicKey);
  console.log(balance.nativeBalance);
} catch (err) {
  if (err instanceof PocketPayError) {
    console.error(err.code, err.message, err.statusCode);
  }
}
```

`PocketPayError` always carries:

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `code` | `string` | Machine-readable error code (e.g. `ACCOUNT_NOT_FOUND`) |
| `statusCode` | `number \| undefined` | HTTP status when applicable |
| `cause` | `Error \| undefined` | Original error that triggered this one |

---

## Style 2 — Typed result wrappers (additive, opt-in)

For UI code, React state handlers, or any context where try/catch is awkward, the SDK exposes `safe*` wrapper functions that never throw. They return a `PocketPayResult<T>` — a discriminated union narrowed by the `ok` boolean.

### Available safe wrappers

| Wrapper | Wraps |
|---|---|
| `safeGetBalance` | `getBalance` |
| `safeSendXLM` | `sendXLM` |
| `safeGetTransactions` | `getTransactions` |
| `safeGetPayments` | `getPayments` |
| `safeFundTestnetAccount` | `fundTestnetAccount` |

### Usage

```ts
import { safeGetBalance } from '@axionvera/pocketpay-sdk';

const result = await safeGetBalance(publicKey);

if (result.ok) {
  // TypeScript narrows: result is SuccessResult<AccountBalance>
  console.log(result.value.nativeBalance);
} else {
  // TypeScript narrows: result is FailureResult
  console.error(result.error.code, result.error.message);
}
```

### Result types

```ts
// Typed success — access result.value
interface SuccessResult<T> {
  ok: true;
  value: T;
}

// Typed failure — access result.error
interface FailureResult {
  ok: false;
  error: PocketPayError;
}

// The union — discriminate on result.ok
type PocketPayResult<T> = SuccessResult<T> | FailureResult;
```

### The `toResult` generic wrapper

If you want to wrap any promise-returning function yourself:

```ts
import { toResult } from '@axionvera/pocketpay-sdk';

const result = await toResult(
  () => sendXLM(params),
  'Failed to send payment', // error context message (optional)
  'SEND_ERROR'              // fallback error code (optional)
);
```

Any `PocketPayError` thrown by the function is preserved as-is. Any other thrown value is normalised into a `PocketPayError` using the supplied context and code.

### The `toSuccessResult` / `toFailureResult` constructors

Use these when building your own result-returning utilities:

```ts
import { toSuccessResult, toFailureResult, PocketPayError } from '@axionvera/pocketpay-sdk';

function divide(a: number, b: number) {
  if (b === 0) {
    return toFailureResult(new PocketPayError('Division by zero', 'DIV_BY_ZERO'));
  }
  return toSuccessResult(a / b);
}
```

---

## Choosing between styles

| Situation | Recommended style |
|---|---|
| Server-side / Node scripts where exceptions are idiomatic | Throwing (`getBalance`, `sendXLM`, …) |
| UI event handlers, React `useEffect`, form submit | Safe wrappers (`safeGetBalance`, …) |
| Writing your own SDK wrappers or middleware | `toResult` / `toSuccessResult` / `toFailureResult` |
| Existing code you don't want to change | Keep the throwing style — nothing is removed |

Both styles coexist. Existing SDK users are not required to migrate.

---

## Error codes quick reference

| Code | Meaning |
|---|---|
| `INVALID_PUBLIC_KEY` | Stellar public key is malformed |
| `INVALID_SECRET_KEY` | Stellar secret key is malformed |
| `INVALID_AMOUNT` | Amount is zero, negative, or non-numeric |
| `INVALID_AMOUNT_PRECISION` | More than 7 decimal places |
| `INVALID_MEMO` | Memo exceeds 28-byte limit |
| `ACCOUNT_NOT_FOUND` | Account does not exist on the network |
| `SELF_PAYMENT` | Source and destination are the same account |
| `PAYMENT_FAILED` | Horizon rejected the transaction |
| `SEND_ERROR` | Network or unexpected error during send |
| `BALANCE_ERROR` | Network or unexpected error fetching balance |
| `FUND_ERROR` | Network or unexpected error during Friendbot call |
| `FRIENDBOT_ERROR` | Friendbot returned a non-2xx HTTP status |
| `TESTNET_ONLY` | `fundTestnetAccount` called on mainnet |
| `TX_FETCH_ERROR` | Network error fetching transactions |
| `PAYMENTS_FETCH_ERROR` | Network error fetching payments |

For transient errors (429, 503, 504) see the [Network Errors Guide](./network-errors.md).
