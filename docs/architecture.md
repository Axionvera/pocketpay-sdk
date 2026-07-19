# PocketPay SDK Architecture

This document explains how the PocketPay SDK is organized, what each module is
responsible for, and how data flows from a consuming application down to the
Stellar network and Soroban contracts. Read it before adding new behaviour so
you know which module owns what.

## Where the SDK sits

PocketPay is split across three repos. The SDK is the middle layer.

```
pocketpay-mobile  →  pocketpay-sdk  →  Stellar Testnet (Horizon, Friendbot)
   (mobile app)      (this repo)     →  Soroban RPC → pocketpay-contracts
```

- **pocketpay-mobile** — the mobile app. It consumes this SDK from the package
  root and never talks to Horizon or Soroban directly.
- **pocketpay-sdk** (this repo) — TypeScript helpers for wallets, payments,
  transaction history, and Soroban vault calls. It owns validation, network
  access, and the typed models returned to callers.
- **pocketpay-contracts** — the Soroban smart contracts, including the savings
  vault. The vault helpers here only work once a contract from that repo is
  deployed and its `VAULT_CONTRACT_ID` is supplied to the SDK.

### SDK boundary versus the mobile app

The SDK does one thing: it turns a typed function call into a Stellar or
Soroban operation and returns a typed result. It holds no UI, no navigation,
and no persistent state. Anything about screens, user sessions, or storing a
secret key belongs in the mobile app, not here. The SDK never persists a secret
key anywhere, so the app is responsible for backing one up after wallet
creation.

### SDK boundary versus the contracts repo

The SDK does not contain contract logic. The Soroban module builds and submits
contract calls, but the vault behaviour itself lives in pocketpay-contracts.
When the contract changes, the call shape in the Soroban module may change with
it. Treat the vault helpers as pre-release for that reason.

## The single entry point

Everything public is re-exported from `src/index.ts`, and the package root is
the only supported entry point.

```typescript
import { createWallet, sendXLM, getBalance } from 'stellar-pocketpay-sdk';
```

Deep imports such as `stellar-pocketpay-sdk/wallet` are not supported. Anything
not re-exported from the root is an internal detail and may change without
notice.

## Modules

### types

The shared vocabulary for the whole SDK. It defines the config shape
(`SDKConfig`, `StellarNetwork`), the wallet and balance shapes
(`WalletKeypair`, `AccountBalance`, `BalanceResult`), the payment and history
models (`PaymentResult`, `TransactionSummary`, `PaymentSummary`, and their
list wrappers), the vault shapes (`VaultDepositParams`, `VaultWithdrawParams`,
`VaultResult`), and the result envelope used across the SDK
(`PocketPayResult<T>`, `SuccessResult<T>`, `FailureResult`, `PocketPayError`).
The former `TransactionRecord` and `PaymentRecord` names stay exported as
aliases for backward compatibility. This module owns type contracts only; it
holds no runtime behaviour.

### config

Turns caller overrides into a resolved, validated `SDKConfig`. It validates the
network, Horizon and Soroban RPC URLs, timeout, and contract IDs, then exposes
resolved values through helpers like `resolveConfig`, `getHorizonServer`,
`getSorobanRpcUrl`, `getNetworkPassphrase`, and `getFriendbotUrl`. A pluggable
Horizon server factory (`setHorizonServerFactory`, `resetHorizonServerFactory`)
lets tests swap the network layer. Every module that touches the network reads
its endpoints from here rather than hardcoding them.

### utils

Cross-cutting helpers used by every feature module. Two groups live here. First,
validation and conversion: `validatePublicKey`, `validateSecretKey`,
`validateAmount`, `validateMemo`, `validateTransactionHash`, plus
`stroopsToXLM`, `xlmToStroops`, and `truncateAddress`. Second, the result
plumbing: `toSuccessResult`, `toFailureResult`, `toResult`, and `wrapError`,
which wrap raw calls in the `PocketPayResult` envelope, along with the `safe*`
wrappers (`safeGetBalance`, `safeSendXLM`, `safeGetTransactions`,
`safeGetPayments`, `safeFundTestnetAccount`) that return a typed result instead
of throwing.

### network

The low-level timeout layer. `withTimeout` races any promise against a deadline,
and `fetchWithTimeout` applies that to raw HTTP calls. Feature modules use this
so a slow endpoint fails cleanly instead of hanging.

### wallet

Account and balance operations. `createWallet` generates a fresh keypair,
`importWallet` and `getPublicKey` work from an existing secret,
`fundTestnetAccount` tops up a Testnet account through Friendbot, and
`getBalance` / `getBalanceOrUnfunded` read balances from Horizon. Note the
security contract: `createWallet` never persists the secret key, so the caller
must save it immediately.

### payments

Sending value. `sendXLM` validates the parameters through utils, resolves
endpoints through config, builds and submits the payment to Horizon, and returns
a typed `PaymentResult`.

### transactions

Reading history. `getTransactions` and `getPayments` fetch from Horizon and
return SDK-owned typed models (`TransactionSummary`, `PaymentSummary`) rather
than raw Horizon shapes, so callers depend on a stable contract. Both return a
paginated list of the form `{ records, count, nextCursor? }`; pass `nextCursor`
back to fetch the next page.

### soroban

The vault call layer. `depositToVault`, `withdrawFromVault`, and
`getVaultBalance` build Soroban contract invocations against the savings-vault
contract and submit them through the Soroban RPC endpoint from config. This is
the only module that talks to Soroban, and it depends on a deployed contract
from pocketpay-contracts plus a configured `VAULT_CONTRACT_ID`.

## How data flows

A typical call runs through the same layers in order:

1. **App** calls a root export, for example `sendXLM(params)`.
2. **Feature module** (`payments`) validates the input using **utils** and
   pulls endpoints and network settings from **config**.
3. **config** hands back a resolved `SDKConfig` and the correct Horizon or
   Soroban target.
4. The feature module builds the operation and sends it over the network,
   using **network** for timeout behaviour.
   - Payments, wallet reads, and history go to **Horizon / Friendbot**.
   - Vault calls go through **Soroban RPC** to the deployed contract.
5. The raw response is mapped into a **types** model and wrapped in a
   `PocketPayResult` by **utils**, then returned to the app.

Every path shares the same spine: validate in utils, resolve in config, execute
over network, and return a typed result. New behaviour should follow that same
order and land in the module that owns its concern.

## Adding new behaviour

- New shared shape → **types**.
- New endpoint, setting, or validation of config input → **config**.
- New validator, converter, or result helper → **utils**.
- New account or balance operation → **wallet**.
- New way to move value → **payments**.
- New history query → **transactions**.
- New contract call → **soroban**.

Keep the public surface behind the package root, and reuse the validate →
resolve → execute → wrap flow rather than reaching around it.