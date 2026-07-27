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

### diagnostics

Opt-in observability for support and local debugging. The module owns the
redacted report model (`buildDiagnosticsReport`), lifecycle hook registry
(`enableDiagnostics` / `emitDiagnosticsEvent`), and deny-list redaction
(`redactDiagnosticsValue`). Feature modules may emit events; diagnostics must
not import wallet/payments/soroban implementation details beyond types already
available through config and the capability registry. Hooks are off by default.
See [diagnostics.md](./diagnostics.md).

### errors

Error classification and redaction, used by every other module. Owns
`PocketPayError`, the error taxonomy (`ErrorCategory`, `ErrorCode`), the
capability registry (`SDK_CAPABILITIES`, `assertCapability`) used to gate
unsupported features, and submission-outcome classification
(`classifySubmitError`, `classifySubmissionOutcome`) that turns a raw
Horizon/network failure into a typed, retry-aware result. `redactSensitive`
and `redactError` here are the SDK's primary defence against leaking a
secret key or signed XDR into a thrown error's message — route new error
construction through this module rather than building error messages by
hand in a feature module.

### account

Identity and signing abstraction, separate from `wallet`. Owns
`AccountIdentity` (public key only), the `Signer` interface, `LocalSigner`
(a `Signer` backed by an in-memory keypair), the `ExternalSignerAdapter`
extension point for hardware/mobile/browser signers this SDK doesn't
implement itself, and sequence-freshness helpers (`isSequenceStale`,
`validateSequenceValue`) used for offline transaction preparation. Only
`transactions` has adopted this abstraction so far, for its offline-signing
flow; `wallet`, `payments`, and `soroban` still manage keys inline and are
expected to migrate to it over time rather than duplicate signing logic.

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

### vault

A thin, discoverable public alias over `soroban`: `depositToVault`,
`withdrawFromVault`, `getVaultBalance`, and the Soroban result mappers are
re-exported here unchanged, alongside the vault-specific types. It holds no
implementation of its own — new vault behaviour is built in `soroban` and
re-exported here if it should be part of the public vault surface.

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
- New error code, classification rule, or capability gate → **errors**.
- New endpoint, setting, or validation of config input → **config**.
- New validator, converter, or result helper → **utils**.
- New signing capability or identity concern (not tied to one feature) → **account**.
- New keypair or balance operation → **wallet**.
- New way to move value → **payments**.
- New history query → **transactions**.
- New contract call → **soroban**, then re-export from **vault** if it should be public.

Keep the public surface behind the package root, and reuse the validate →
resolve → execute → wrap flow rather than reaching around it.

## Module Hierarchy & Import Direction Rules

Internal module imports follow a layered, mostly-acyclic hierarchy: `types`
at the bottom, cross-cutting infrastructure (`errors`, `utils`, `config`,
`diagnostics`, `network`, `account`) above it, feature modules
(`wallet`, `payments`, `transactions`, `soroban`) above that, `vault` as a
thin re-export facade over `soroban`, and `src/index.ts` re-exporting the
public surface from all of them.

For the complete, per-module dependency table — including the one
module-level exception (`transactions` depending on `account`) and the
`config`/`diagnostics` mutual reference that looks circular but isn't at the
file level — see
[the SDK Package Boundary & Dependency Direction Map](./dependency_direction_map.md),
which is verified directly against `src/`'s actual imports rather than
hand-maintained here.

### Circular Dependency Check

To ensure no circular imports are introduced:

```bash
npm run check:circular
```

This script (`scripts/check-circular-deps.ts`) performs a lightweight, static graph traversal over all module files in `src/` using DFS to detect cycle paths before build time. It is automatically executed during `npm run verify`.