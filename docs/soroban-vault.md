# Soroban Savings Vault

This guide documents the SDK helpers that talk to the **PocketPay Savings Vault**
Soroban smart contract: `depositToVault`, `withdrawFromVault`, and
`getVaultBalance`. It also explains how the `VAULT_CONTRACT_ID` is resolved, how
each helper maps onto the on-chain contract, and — importantly — the **current
limitations** of that contract so you know exactly what these calls do and don't
do today.

The contract these helpers target lives in
[`Axionvera/pocketpay-contracts`](https://github.com/Axionvera/pocketpay-contracts)
under `contracts/savings_vault`. This document is kept aligned with that source.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [The `VAULT_CONTRACT_ID`](#the-vault_contract_id)
- [Configuration & Network](#configuration--network)
- [Helpers](#helpers)
  - [`depositToVault`](#deposittovault)
  - [`withdrawFromVault`](#withdrawfromvault)
  - [`getVaultBalance`](#getvaultbalance)
- [How helpers map to the contract](#how-helpers-map-to-the-contract)
- [Current contract limitations](#current-contract-limitations)
- [Error handling](#error-handling)
- [Full example](#full-example)

---

## Prerequisites

Before any vault helper will work you need:

1. **A deployed, initialized Savings Vault contract** on the network you're
   targeting (Testnet by default). Deploy it from the
   [`pocketpay-contracts`](https://github.com/Axionvera/pocketpay-contracts)
   repo, then call its `initialize(admin)` method once. The SDK does **not**
   wrap deployment or initialization — it assumes the contract already exists.
2. **The contract's ID** (a `C...` strkey), provided to the SDK via a parameter
   or the `VAULT_CONTRACT_ID` environment variable (see below).
3. **A funded source account** for deposits/withdrawals — the account whose
   secret key signs the transaction must exist on-network. On Testnet you can
   fund it with `fundTestnetAccount(publicKey)`.

---

## The `VAULT_CONTRACT_ID`

Every vault helper needs to know which deployed contract to call. The ID is
resolved by `resolveContractId()` with this precedence:

1. The `contractId` passed in the params object, **if present**.
2. Otherwise, the `VAULT_CONTRACT_ID` environment variable.
3. If neither is set, the call throws a `PocketPayError` with code
   `MISSING_CONTRACT_ID`.

```typescript
// Option A — pass it explicitly
await getVaultBalance({
  publicKey: 'GABC...',
  contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
});

// Option B — set it once in the environment
// .env
//   VAULT_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
await getVaultBalance({ publicKey: 'GABC...' });
```

> **Type note:** In `VaultDepositParams` / `VaultWithdrawParams` /
> `VaultBalanceParams` the `contractId` field is typed as a required `string`,
> but at runtime the helpers fall back to `VAULT_CONTRACT_ID` when it is omitted.
> If you rely on the environment variable, you may need to cast or provide the
> field to satisfy the type checker.

---

## Configuration & Network

Vault helpers accept an optional second argument, `config?: Partial<SDKConfig>`,
which is resolved by `resolveConfig()`. The relevant field for Soroban is the
RPC URL, which defaults per-network:

| Network   | Default Soroban RPC URL                     |
| --------- | ------------------------------------------- |
| `testnet` | `https://soroban-testnet.stellar.org`       |
| `mainnet` | `https://soroban.stellar.org`               |

You can override it per-call, via `STELLAR_SOROBAN_RPC_URL`, or via
`STELLAR_NETWORK`. The default network is **testnet**.

```typescript
await depositToVault(params, {
  network: 'testnet',
  sorobanRpcUrl: 'https://my-custom-rpc.example.com',
});
```

---

## Helpers

All three helpers return a `VaultResult`:

```typescript
interface VaultResult {
  success: boolean;   // whether the operation succeeded
  hash?: string;      // transaction hash (deposit / withdraw only)
  balance?: string;   // resulting balance in XLM (getVaultBalance only)
  error?: string;     // human-readable error, when success is false
}
```

Note the two failure styles: **expected** on-chain failures (a failed
simulation, a rejected send, a non-`SUCCESS` status) are returned as
`{ success: false, error }`, whereas **programmer / environment** errors
(missing contract ID, invalid keys, RPC unreachable) are **thrown** as
`PocketPayError`. Handle both — wrap calls in `try/catch` *and* check `success`.

### `depositToVault`

```typescript
depositToVault(
  params: VaultDepositParams,
  config?: Partial<SDKConfig>
): Promise<VaultResult>
```

Builds, simulates, signs, and submits a call to the contract's `deposit`
method, then polls until the transaction resolves.

| Param          | Type     | Description                                  |
| -------------- | -------- | -------------------------------------------- |
| `sourceSecret` | `string` | Secret key of the depositor (signs the tx).  |
| `amount`       | `string` | Amount of XLM to deposit, e.g. `'100'`.      |
| `contractId`   | `string` | Vault contract ID (or set via env var).      |

The `amount` is validated by `validateAmount` and converted to an integer with
`Math.round(parseFloat(amount) * 10_000_000)` (a stroops-style representation)
before being passed to the contract as an `i128`.

```typescript
const result = await depositToVault({
  sourceSecret: wallet.secretKey,
  amount: '100',
  contractId,
});

if (result.success) {
  console.log('Deposited, tx hash:', result.hash);
} else {
  console.error('Deposit failed:', result.error);
}
```

### `withdrawFromVault`

```typescript
withdrawFromVault(
  params: VaultWithdrawParams,
  config?: Partial<SDKConfig>
): Promise<VaultResult>
```

Same flow as `depositToVault` but calls the contract's `withdraw` method. The
contract rejects the call (simulation fails) if `amount` exceeds the caller's
available balance or is not greater than zero.

| Param          | Type     | Description                                   |
| -------------- | -------- | --------------------------------------------- |
| `sourceSecret` | `string` | Secret key of the withdrawer (signs the tx).  |
| `amount`       | `string` | Amount of XLM to withdraw, e.g. `'50'`.       |
| `contractId`   | `string` | Vault contract ID (or set via env var).       |

```typescript
const result = await withdrawFromVault({
  sourceSecret: wallet.secretKey,
  amount: '50',
  contractId,
});
```

### `getVaultBalance`

```typescript
getVaultBalance(
  params: VaultBalanceParams,
  config?: Partial<SDKConfig>
): Promise<VaultResult>
```

Queries the caller's **available (unlocked)** balance. This is a **read-only**
operation: it calls the contract's `get_balance` method and reads the return
value from the transaction *simulation* — nothing is signed or submitted to the
network, so it costs no fees.

| Param        | Type     | Description                               |
| ------------ | -------- | ----------------------------------------- |
| `publicKey`  | `string` | Public key of the user to query.          |
| `contractId` | `string` | Vault contract ID (or set via env var).   |

The raw `i128` returned by the contract is divided by `10_000_000` and returned
as a fixed 7-decimal XLM string in `result.balance`. If the user has never
deposited, the contract returns `0` and `balance` is `'0.0000000'`.

```typescript
const result = await getVaultBalance({ publicKey: wallet.publicKey, contractId });
if (result.success) console.log('Vault balance:', result.balance, 'XLM');
```

> Even though `get_balance` is read-only, the SDK still calls
> `getAccount(publicKey)` to build the simulation transaction, so the queried
> account must exist on-network.

---

## How helpers map to the contract

The Savings Vault contract exposes **seven** methods. The SDK currently wraps
**three** of them:

| Contract method (`savings_vault`)        | SDK helper           | Notes                                       |
| ---------------------------------------- | -------------------- | ------------------------------------------- |
| `deposit(user, amount)`                  | `depositToVault`     | `amount` is `i128`; user auth required.     |
| `withdraw(user, amount)`                 | `withdrawFromVault`  | Fails if amount > available balance.        |
| `get_balance(user) -> i128`              | `getVaultBalance`    | Read-only, via simulation.                  |
| `initialize(admin)`                      | — *(not wrapped)*    | One-time, admin-only. Do it out-of-band.    |
| `lock_funds(user, amount, unlock_time)`  | — *(not wrapped)*    | Time-locks part of the balance.             |
| `get_locked_balance(user) -> i128`       | — *(not wrapped)*    | Returns locked (not available) balance.     |
| `can_withdraw(user) -> bool`             | — *(not wrapped)*    | True once the unlock timestamp has passed.  |

Auth model: the contract's `deposit` / `withdraw` call `user.require_auth()`.
The SDK satisfies this by signing the prepared transaction with the
`sourceSecret` keypair, so the signer and the `user` address must match.

---

## Result Mapping & Mobile Integration

Raw contract responses from Soroban RPC nodes (such as simulation outputs, XDR payloads, or status flags) can be complex for application logic and mobile clients to handle directly. The SDK provides standard result mappers (`mapSorobanInvocationResult`, `mapVaultInvocationResult`, and `mapSorobanContractError`) that map raw contract outputs into stable, typed values.

### Invocation Result Shapes

```typescript
import {
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
  SorobanInvocationResult,
  VaultMappedResult,
} from 'stellar-pocketpay-sdk';

// Generic Soroban Invocation Result
interface SorobanInvocationResult<T = unknown> {
  success: boolean;                           // High-level success flag
  status: 'success' | 'failed' | 'simulation_error' | 'error' | 'pending';
  result?: T;                                 // Parsed contract return value
  error?: string;                             // Formatted error message
  errorCode?: string | number;                // Classified error code
  hash?: string;                              // Transaction hash if submitted
  rawResponse?: unknown;                      // Raw RPC response object
}

// Vault-specific Mapped Result (returned by depositToVault, withdrawFromVault, getVaultBalance)
interface VaultMappedResult {
  success: boolean;
  status: 'success' | 'failed' | 'simulation_error' | 'error' | 'pending';
  operation: 'deposit' | 'withdraw' | 'get_balance';
  hash?: string;
  balance?: string;                          // Formatted XLM balance string (e.g. "15.0000000")
  rawStroops?: string;                       // Raw sub-unit balance (e.g. "150000000")
  amount?: string;                           // Amount requested (deposit/withdraw)
  error?: string;
  errorCode?: string | number;
}
```

### Direct Usage Example

```typescript
import { mapSorobanInvocationResult, mapVaultInvocationResult } from 'stellar-pocketpay-sdk';

// 1. Mapping a raw Soroban simulation response
const simResponse = await sorobanServer.simulateTransaction(tx);
const mappedSim = mapSorobanInvocationResult(simResponse);

if (mappedSim.success) {
  console.log('Parsed return value:', mappedSim.result);
} else {
  console.error('Simulation error:', mappedSim.error, 'Code:', mappedSim.errorCode);
}

// 2. Mapping vault invocation responses
const mappedVault = mapVaultInvocationResult('get_balance', simResponse, { contractId });
console.log('Balance XLM:', mappedVault.balance, 'Raw Stroops:', mappedVault.rawStroops);
```

---

## Current contract limitations

These are real limitations of the contract as it exists today. Read them before
building anything on top of these helpers.

1. **The vault is internal bookkeeping, not token custody.** The contract's
   `deposit` simply *increments a stored `i128` balance* for the user, and
   `withdraw` decrements it. It does **not** perform any token transfer — no XLM
   or SAC token actually moves into or out of the contract. Depositing does not
   remove funds from your wallet, and withdrawing does not send funds back. The
   stored balance is an accounting number only. Do not treat these helpers as
   moving real value until the contract integrates a token transfer.

2. **Amounts are unitless integers on-chain.** The contract stores whatever
   `i128` it is given; it has no concept of decimals or stroops. The
   `× 10_000_000` / `÷ 10_000_000` conversion is a **convention applied by the
   SDK only**. Every writer of that balance must use the same convention, or
   reads will be off by orders of magnitude.

3. **Only 3 of 7 methods are wrapped.** There are no SDK helpers for
   `initialize`, `lock_funds`, `get_locked_balance`, or `can_withdraw`. If you
   need fund-locking, you must call the contract directly (e.g. via the Stellar
   SDK or Soroban CLI) for now.

4. **`getVaultBalance` reports only the *available* balance.** It calls
   `get_balance`, which excludes locked funds. If funds have been locked via
   `lock_funds` (out-of-band), they will not appear in `result.balance`; query
   `get_locked_balance` directly to see them.

5. **No on-chain events.** The contract emits diagnostic `log!` output, not
   `env.events()`. There is nothing to subscribe to for deposit/withdraw
   notifications — the SDK relies on the transaction hash and status instead.

6. **The contract must be initialized first.** A freshly deployed contract must
   have `initialize(admin)` called exactly once before use. The SDK does not do
   this and does not check for it.

---

## Error handling

Vault-relevant error codes carried on `PocketPayError.code`:

| Code                   | When it occurs                                            |
| ---------------------- | -------------------------------------------------------- |
| `MISSING_CONTRACT_ID`  | No `contractId` param and no `VAULT_CONTRACT_ID` env var. |
| `INVALID_SECRET_KEY`   | `sourceSecret` is not a valid Stellar secret key.        |
| `INVALID_PUBLIC_KEY`   | `publicKey` is not a valid Stellar public key.           |
| `INVALID_AMOUNT`       | Amount is non-numeric or not greater than zero.          |
| `VAULT_DEPOSIT_ERROR`  | An unexpected error was thrown during a deposit.         |
| `VAULT_WITHDRAW_ERROR` | An unexpected error was thrown during a withdrawal.      |
| `VAULT_BALANCE_ERROR`  | An unexpected error was thrown during a balance query.   |

```typescript
import { depositToVault, PocketPayError } from 'stellar-pocketpay-sdk';

try {
  const result = await depositToVault(params);
  if (!result.success) {
    // expected on-chain failure (e.g. simulation rejected)
    console.error('On-chain failure:', result.error);
  }
} catch (error) {
  if (error instanceof PocketPayError) {
    console.error(error.code, error.message);
  }
}
```

---

## Full example

A complete, runnable script lives at
[`examples/vault-operations.ts`](../examples/vault-operations.ts):

```bash
VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-operations.ts
```

It creates and funds a Testnet wallet, deposits into the vault, queries the
balance, and withdraws — a good end-to-end reference for wiring these helpers
together.
