# API Reference

Every function exported from the PocketPay SDK package root, grouped by
module. Each entry shows the signature, parameters, return type, and a
short usage example.

All examples use placeholder keys — never commit or log real secret keys.
See [Security Best Practices](./security.md) for key-handling guidance.

## Table of Contents

- [Wallet](#wallet)
- [Payments](#payments)
- [Transactions](#transactions)
- [Soroban Vault](#soroban-vault)
- [Config](#config)
- [Utils](#utils)

---

## Wallet

### `createWallet()`

Creates a new random Stellar keypair. Does **not** activate it on-chain —
call `fundTestnetAccount` afterward to fund it on testnet.

```ts
import { createWallet } from '@axionvera/pocketpay-sdk';

const wallet = createWallet();
console.log(wallet.publicKey); // G...
console.log(wallet.secretKey); // S... (handle with care, never log in production)
```

**Returns:** `WalletKeypair` — `{ publicKey: string, secretKey: string }`

### `importWallet(secretKey)`

Imports an existing wallet from a secret key.

```ts
import { importWallet } from '@axionvera/pocketpay-sdk';

const wallet = importWallet('S...'); // placeholder secret key
console.log(wallet.publicKey);
```

**Parameters:**
- `secretKey: string` — Stellar secret key (`S...`)

**Returns:** `WalletKeypair`
**Throws:** `PocketPayError` (`INVALID_SECRET_KEY`) if the key is malformed.

### `getPublicKey(secretKey)`

Derives the public key from a secret key without constructing a full wallet object.

```ts
import { getPublicKey } from '@axionvera/pocketpay-sdk';

const publicKey = getPublicKey('S...'); // placeholder secret key
```

**Parameters:**
- `secretKey: string` — Stellar secret key (`S...`)

**Returns:** `string` — the derived public key (`G...`)
**Throws:** `PocketPayError` (`INVALID_SECRET_KEY`) if the key is malformed.

### `getBalance(publicKey, config?)`

Fetches the on-chain balances for a Stellar account.

```ts
import { getBalance } from '@axionvera/pocketpay-sdk';

const balance = await getBalance(wallet.publicKey);
console.log('XLM:', balance.nativeBalance);
```

**Parameters:**
- `publicKey: string` — Stellar public key (`G...`)
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<AccountBalance>`
**Throws:** `PocketPayError` — `INVALID_PUBLIC_KEY`, `ACCOUNT_NOT_FOUND` (404, unfunded account), or `BALANCE_ERROR`.

### `getBalanceOrUnfunded(publicKey, config?)`

Like `getBalance`, but returns a discriminated result instead of throwing
when the account is simply unfunded.

```ts
import { getBalanceOrUnfunded } from '@axionvera/pocketpay-sdk';

const result = await getBalanceOrUnfunded(wallet.publicKey);
if (result.status === 'funded') {
  console.log('XLM:', result.balance.nativeBalance);
} else {
  console.log('Not funded yet:', result.publicKey);
}
```

**Parameters:**
- `publicKey: string` — Stellar public key (`G...`)
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<BalanceResult>` — `{ status: 'funded', publicKey, balance }` or `{ status: 'unfunded', publicKey }`
**Throws:** `PocketPayError` — `INVALID_PUBLIC_KEY` or `BALANCE_ERROR` (non-404 failures only).

### `fundTestnetAccount(publicKey)`

Funds a testnet account via Friendbot (≈10,000 XLM). **Testnet only** —
throws immediately on mainnet without making a network request.

```ts
import { fundTestnetAccount } from '@axionvera/pocketpay-sdk';

const result = await fundTestnetAccount(wallet.publicKey);
if (result.success) {
  console.log('Funded! tx hash:', result.hash, 'ledger:', result.ledger);
}
```

**Parameters:**
- `publicKey: string` — Stellar public key (`G...`) to fund

**Returns:** `Promise<FundResult>`
**Throws:** `PocketPayError` — `TESTNET_ONLY`, `INVALID_PUBLIC_KEY`, `FRIENDBOT_ERROR`, or `FUND_ERROR`.

---

## Payments

### `sendXLM(params, config?)`

Sends XLM from one account to another. All inputs are validated before any
transaction is built or submitted.

```ts
import { sendXLM } from '@axionvera/pocketpay-sdk';

const result = await sendXLM({
  sourceSecret: 'S...', // placeholder secret key
  destination: 'G...',  // placeholder public key
  amount: '10.5',
  memo: 'invoice #42',
});
console.log('Sent! tx hash:', result.hash);
```

**Parameters:**
- `params: SendXLMParams` — `{ sourceSecret, destination, amount, memo? }`
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<PaymentResult>`
**Throws:** `PocketPayError` — validation errors (`INVALID_SECRET_KEY`, `INVALID_PUBLIC_KEY`, `INVALID_AMOUNT`, `INVALID_MEMO`, `SELF_PAYMENT`), `ACCOUNT_NOT_FOUND` (404), `PAYMENT_FAILED`, or `SEND_ERROR`.

---

## Transactions

### `getTransactions(publicKey, limit?, order?, config?)`

Fetches recent transactions for a Stellar account.

```ts
import { getTransactions } from '@axionvera/pocketpay-sdk';

const { records, count } = await getTransactions(wallet.publicKey, 20, 'desc');
console.log(`${count} transactions found`);
records.forEach((tx) => console.log(tx.hash, tx.successful));
```

**Parameters:**
- `publicKey: string` — Stellar public key (`G...`)
- `limit?: number` — max records, default `10`, clamped to 200
- `order?: 'asc' | 'desc'` — sort order, default `'desc'` (newest first)
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<TransactionList>` — `{ records: TransactionSummary[], count, nextCursor? }`
**Throws:** `PocketPayError` — `INVALID_PUBLIC_KEY`, `ACCOUNT_NOT_FOUND` (404), or `TX_FETCH_ERROR`.

### `getPayments(publicKey, limit?, order?, config?)`

Fetches recent payment operations for a Stellar account.

```ts
import { getPayments } from '@axionvera/pocketpay-sdk';

const { records } = await getPayments(wallet.publicKey, 10, 'desc');
records.forEach((p) => console.log(p.from, '->', p.to, p.amount, p.asset));
```

**Parameters:**
- `publicKey: string` — Stellar public key (`G...`)
- `limit?: number` — max records, default `10`, clamped to 200
- `order?: 'asc' | 'desc'` — sort order, default `'desc'`
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<PaymentList>` — `{ records: PaymentSummary[], count, nextCursor? }`
**Throws:** `PocketPayError` — `INVALID_PUBLIC_KEY`, `ACCOUNT_NOT_FOUND` (404), or `PAYMENTS_FETCH_ERROR`.

---

## Soroban Vault

> The vault helpers call a separately-deployed Soroban savings-vault
> contract (see [Relationship to other repos](../README.md#relationship-to-other-repos)
> in the README). Treat them as pre-release: their contract-call shape may
> still change as the contract evolves.

### `depositToVault(params, config?)`

Deposits XLM into the savings vault contract.

```ts
import { depositToVault } from '@axionvera/pocketpay-sdk';

const result = await depositToVault({
  sourceSecret: 'S...', // placeholder secret key
  amount: '100',
  contractId: 'C...',   // placeholder 56-char contract ID
});
if (result.success) {
  console.log('Deposited! tx hash:', result.hash);
}
```

**Parameters:**
- `params: VaultDepositParams` — `{ sourceSecret, amount, contractId }`
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<VaultResult>` — `{ success, hash?, error? }`
**Throws:** `PocketPayError` — validation errors, `MISSING_CONTRACT_ID`, or `VAULT_DEPOSIT_ERROR`.

### `withdrawFromVault(params, config?)`

Withdraws XLM from the savings vault contract.

```ts
import { withdrawFromVault } from '@axionvera/pocketpay-sdk';

const result = await withdrawFromVault({
  sourceSecret: 'S...', // placeholder secret key
  amount: '50',
  contractId: 'C...',   // placeholder 56-char contract ID
});
if (result.success) {
  console.log('Withdrawn! tx hash:', result.hash);
}
```

**Parameters:**
- `params: VaultWithdrawParams` — `{ sourceSecret, amount, contractId }`
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<VaultResult>`
**Throws:** `PocketPayError` — validation errors, `MISSING_CONTRACT_ID`, or `VAULT_WITHDRAW_ERROR`.

### `getVaultBalance(params, config?)`

Queries the vault balance for a given user.

```ts
import { getVaultBalance } from '@axionvera/pocketpay-sdk';

const result = await getVaultBalance({
  publicKey: 'G...', // placeholder public key
  contractId: 'C...', // placeholder 56-char contract ID
});
if (result.success) {
  console.log('Vault balance:', result.balance);
}
```

**Parameters:**
- `params: VaultBalanceParams` — `{ publicKey, contractId }`
- `config?: Partial<SDKConfig>` — optional SDK config overrides

**Returns:** `Promise<VaultResult>` — `{ success, balance?, error? }`
**Throws:** `PocketPayError` — `INVALID_PUBLIC_KEY`, `MISSING_CONTRACT_ID`, or `VAULT_BALANCE_ERROR`.

---

## Config

### `resolveConfig(overrides?)`

Resolves the SDK configuration by merging environment variables with
defaults. Priority: explicit param > env var > default (testnet).

```ts
import { resolveConfig } from '@axionvera/pocketpay-sdk';

const config = resolveConfig({ network: 'testnet' });
console.log(config.horizonUrl);
```

**Parameters:**
- `overrides?: Partial<SDKConfig>` — optional partial config to override defaults

**Returns:** `SDKConfig` — fully resolved and validated config
**Throws:** `PocketPayError` if any configuration value is invalid.

### `getHorizonServer(config?)`

Creates a configured Horizon server instance.

```ts
import { getHorizonServer } from '@axionvera/pocketpay-sdk';

const server = getHorizonServer();
const account = await server.loadAccount('G...'); // placeholder public key
```

**Parameters:**
- `config?: Partial<SDKConfig>` — optional SDK config (resolved automatically if omitted)

**Returns:** `StellarSDK.Horizon.Server`
**Throws:** `PocketPayError` if configuration is invalid.

### `setHorizonServerFactory(factory)`

Overrides the Horizon server factory. Intended for tests, so SDK modules
can be exercised against a mock Horizon client instead of a live server.

```ts
import { setHorizonServerFactory, resetHorizonServerFactory } from '@axionvera/pocketpay-sdk';

setHorizonServerFactory((url) => myMockHorizonServer(url));
// ...run tests against the mock...
resetHorizonServerFactory();
```

**Parameters:**
- `factory: (url: string) => StellarSDK.Horizon.Server` — a function that returns a Horizon.Server-like object for a URL

**Returns:** `void`

### `resetHorizonServerFactory()`

Restores the default factory that builds a real Horizon server. Call this
in test teardown to avoid leaking a mock between test files.

```ts
import { resetHorizonServerFactory } from '@axionvera/pocketpay-sdk';

resetHorizonServerFactory();
```

**Returns:** `void`

### `getNetworkPassphrase(network?)`

Returns the network passphrase for the configured (or given) network.

```ts
import { getNetworkPassphrase } from '@axionvera/pocketpay-sdk';

const passphrase = getNetworkPassphrase('testnet');
```

**Parameters:**
- `network?: StellarNetwork` — target network, default: resolved from config

**Returns:** `string`
**Throws:** `PocketPayError` if network is unsupported.

### `getFriendbotUrl()`

Returns the Friendbot URL for testnet funding.

```ts
import { getFriendbotUrl } from '@axionvera/pocketpay-sdk';

console.log(getFriendbotUrl()); // https://friendbot.stellar.org
```

**Returns:** `string`

### `validateNetwork(network)`

Validates that a network name is supported (`'testnet'` or `'mainnet'`).

```ts
import { validateNetwork } from '@axionvera/pocketpay-sdk';

validateNetwork('testnet'); // does not throw
```

**Parameters:**
- `network: unknown` — the network name to validate

**Returns:** `void` (TypeScript assertion: narrows to `StellarNetwork`)
**Throws:** `PocketPayError` (`INVALID_NETWORK`) if unsupported.

### `validateHorizonUrl(url)`

Validates Horizon URL format.

```ts
import { validateHorizonUrl } from '@axionvera/pocketpay-sdk';

validateHorizonUrl('https://horizon-testnet.stellar.org'); // does not throw
```

**Parameters:**
- `url: string` — the URL to validate

**Returns:** `void`
**Throws:** `PocketPayError` (`INVALID_HORIZON_URL`) if invalid.

### `validateSorobanRpcUrl(url)`

Validates Soroban RPC URL format.

```ts
import { validateSorobanRpcUrl } from '@axionvera/pocketpay-sdk';

validateSorobanRpcUrl('https://soroban-testnet.stellar.org'); // does not throw
```

**Parameters:**
- `url: string` — the URL to validate

**Returns:** `void`
**Throws:** `PocketPayError` (`INVALID_SOROBAN_RPC_URL`) if invalid.

### `validateTimeout(timeout)`

Validates a timeout value (milliseconds).

```ts
import { validateTimeout } from '@axionvera/pocketpay-sdk';

validateTimeout(30000); // does not throw
```

**Parameters:**
- `timeout: unknown` — the timeout value to validate

**Returns:** `void` (TypeScript assertion: narrows to `number`)
**Throws:** `PocketPayError` (`INVALID_TIMEOUT`) if not a positive finite number.

### `validateContractId(contractId)`

Validates Soroban contract ID format (56-character base32 string starting
with `C`).

```ts
import { validateContractId } from '@axionvera/pocketpay-sdk';

validateContractId('C...'); // placeholder 56-char contract ID; does not throw if valid
```

**Parameters:**
- `contractId: string` — the contract ID to validate

**Returns:** `void`
**Throws:** `PocketPayError` (`INVALID_CONTRACT_ID`) if malformed.

---

## Utils

### `validatePublicKey(publicKey)`

Validates a Stellar public key.

```ts
import { validatePublicKey } from '@axionvera/pocketpay-sdk';

validatePublicKey('G...'); // placeholder public key; does not throw if valid
```

**Parameters:**
- `publicKey: string`

**Returns:** `boolean` (always `true` when it doesn't throw)
**Throws:** `PocketPayError` (`INVALID_PUBLIC_KEY`) if malformed.

### `validateSecretKey(secretKey)`

Validates a Stellar secret key.

```ts
import { validateSecretKey } from '@axionvera/pocketpay-sdk';

validateSecretKey('S...'); // placeholder secret key; does not throw if valid
```

**Parameters:**
- `secretKey: string`

**Returns:** `boolean`
**Throws:** `PocketPayError` (`INVALID_SECRET_KEY`) if malformed.

### `validateAmount(amount)`

Validates that an amount string is a positive decimal with at most 7
decimal places.

```ts
import { validateAmount } from '@axionvera/pocketpay-sdk';

validateAmount('10.5'); // does not throw
```

**Parameters:**
- `amount: string`

**Returns:** `boolean`
**Throws:** `PocketPayError` (`INVALID_AMOUNT` or `INVALID_AMOUNT_PRECISION`).

### `validateMemo(memo?)`

Validates a memo string (max 28 bytes). `undefined`/empty is always valid.

```ts
import { validateMemo } from '@axionvera/pocketpay-sdk';

validateMemo('invoice #42'); // does not throw
```

**Parameters:**
- `memo?: string`

**Returns:** `boolean`
**Throws:** `PocketPayError` (`INVALID_MEMO`) if it exceeds 28 bytes.

### `stroopsToXLM(stroops)`

Converts stroops to an XLM decimal string.

```ts
import { stroopsToXLM } from '@axionvera/pocketpay-sdk';

console.log(stroopsToXLM(10_000_000)); // "1.0000000"
```

**Parameters:**
- `stroops: string | number`

**Returns:** `string`

### `xlmToStroops(xlm)`

Converts an XLM amount to stroops.

```ts
import { xlmToStroops } from '@axionvera/pocketpay-sdk';

console.log(xlmToStroops('1.5')); // 15000000
```

**Parameters:**
- `xlm: string | number`

**Returns:** `number`

### `truncateAddress(address, startChars?, endChars?)`

Truncates a long address for display, e.g. `GABC...WXYZ`.

```ts
import { truncateAddress } from '@axionvera/pocketpay-sdk';

console.log(truncateAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567')); // "GABC...4567"
```

**Parameters:**
- `address: string`
- `startChars?: number` — default `4`
- `endChars?: number` — default `4`

**Returns:** `string`

### `toSuccessResult(value)`

Wraps a value in a `SuccessResult`.

```ts
import { toSuccessResult } from '@axionvera/pocketpay-sdk';

const result = toSuccessResult({ nativeBalance: '100' });
// { ok: true, value: { nativeBalance: '100' } }
```

**Parameters:**
- `value: T`

**Returns:** `SuccessResult<T>`

### `toFailureResult(error)`

Wraps a `PocketPayError` in a `FailureResult`.

```ts
import { toFailureResult, PocketPayError } from '@axionvera/pocketpay-sdk';

const result = toFailureResult(new PocketPayError('failed', 'SOME_ERROR'));
// { ok: false, error: PocketPayError }
```

**Parameters:**
- `error: PocketPayError`

**Returns:** `FailureResult`

### `toResult(fn, errorContext?, errorCode?)`

Runs an async function and converts a thrown error into a `FailureResult`
instead of propagating it. Used internally by the `safe*` wrappers below,
and usable directly for any custom async operation.

```ts
import { toResult } from '@axionvera/pocketpay-sdk';

const result = await toResult(
  () => someAsyncOperation(),
  'Custom operation failed',
  'CUSTOM_ERROR',
);
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error.code);
}
```

**Parameters:**
- `fn: () => Promise<T>`
- `errorContext?: string` — used when wrapping a non-`PocketPayError` throw
- `errorCode?: string` — used when wrapping a non-`PocketPayError` throw

**Returns:** `Promise<PocketPayResult<T>>`

### `safeGetBalance(publicKey, config?)`

Non-throwing wrapper around [`getBalance`](#getbalancepublickey-config).

```ts
import { safeGetBalance } from '@axionvera/pocketpay-sdk';

const result = await safeGetBalance(wallet.publicKey);
if (result.ok) {
  console.log(result.value.nativeBalance);
} else {
  console.error(result.error.code);
}
```

**Parameters:**
- `publicKey: string`
- `config?: Partial<SDKConfig>`

**Returns:** `Promise<PocketPayResult<AccountBalance>>`

### `safeFundTestnetAccount(publicKey)`

Non-throwing wrapper around [`fundTestnetAccount`](#fundtestnetaccountpublickey).

```ts
import { safeFundTestnetAccount } from '@axionvera/pocketpay-sdk';

const result = await safeFundTestnetAccount(wallet.publicKey);
if (result.ok) {
  console.log('Funded:', result.value.hash);
}
```

**Parameters:**
- `publicKey: string`

**Returns:** `Promise<PocketPayResult<FundResult>>`

### `safeSendXLM(params, config?)`

Non-throwing wrapper around [`sendXLM`](#sendxlmparams-config).

```ts
import { safeSendXLM } from '@axionvera/pocketpay-sdk';

const result = await safeSendXLM({
  sourceSecret: 'S...', // placeholder secret key
  destination: 'G...',  // placeholder public key
  amount: '10',
});
if (!result.ok) {
  console.error(result.error.code);
}
```

**Parameters:**
- `params: SendXLMParams`
- `config?: Partial<SDKConfig>`

**Returns:** `Promise<PocketPayResult<PaymentResult>>`

### `safeGetTransactions(publicKey, limit?, order?, config?)`

Non-throwing wrapper around [`getTransactions`](#gettransactionspublickey-limit-order-config).

```ts
import { safeGetTransactions } from '@axionvera/pocketpay-sdk';

const result = await safeGetTransactions(wallet.publicKey, 20);
if (result.ok) {
  console.log(result.value.records.length);
}
```

**Parameters:**
- `publicKey: string`
- `limit?: number` — default `10`
- `order?: 'asc' | 'desc'` — default `'desc'`
- `config?: Partial<SDKConfig>`

**Returns:** `Promise<PocketPayResult<TransactionList>>`

### `safeGetPayments(publicKey, limit?, order?, config?)`

Non-throwing wrapper around [`getPayments`](#getpaymentspublickey-limit-order-config).

```ts
import { safeGetPayments } from '@axionvera/pocketpay-sdk';

const result = await safeGetPayments(wallet.publicKey, 20);
if (result.ok) {
  console.log(result.value.records.length);
}
```

**Parameters:**
- `publicKey: string`
- `limit?: number` — default `10`
- `order?: 'asc' | 'desc'` — default `'desc'`
- `config?: Partial<SDKConfig>`

**Returns:** `Promise<PocketPayResult<PaymentList>>`
