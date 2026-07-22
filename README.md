# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Project Status

This SDK is under active development and is **Testnet-focused**. Wallet
creation, XLM payments, and transaction/payment history are implemented and
tested against Stellar's public Testnet (Horizon + Friendbot).

The Soroban savings-vault helpers (`depositToVault`, `withdrawFromVault`,
`getVaultBalance`) are implemented in this SDK, but they call out to a
separate savings-vault smart contract that must be deployed independently —
see [Relationship to other repos](#relationship-to-other-repos) below. Treat
the vault helpers as pre-release: their contract-call shape may still change
as the contract itself evolves.

Nothing in this SDK has been audited or hardened for Mainnet/production use.
If you plan to use it beyond Testnet experimentation, review the code
yourself first — don't treat this as production-ready as-is.

## Relationship to other repos

PocketPay is split across three repos, each with a distinct job:

- **[Axionvera/pocketpay-sdk](.)** (this repo) — the TypeScript helper
  library in this document: wallet management, payments, transaction
  history, and Soroban vault call wrappers.
- **[Axionvera/pocketpay-mobile](https://github.com/Axionvera/pocketpay-mobile)**
  — the mobile app that consumes this SDK from its package root (see
  [Quick Start](#quick-start) below) to power the actual PocketPay user
  experience.
- **[Axionvera/pocketpay-contracts](https://github.com/Axionvera/pocketpay-contracts)**
  — the Soroban smart contracts, including the savings vault contract that
  the vault helpers in this SDK call into. The vault helpers here are only
  useful once a contract from that repo is deployed and its `VAULT_CONTRACT_ID`
  is supplied to the SDK.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [SDK Roadmap](./docs/roadmap.md) - Directional plans and contributor opportunities across the SDK
- [Testing](./docs/testing.md) - Unit vs integration test lanes and the offline guarantee
- [Getting Started](./docs/getting-started.md) - Step-by-step guide to install, create wallets, fund accounts, check balances, and send payments
- [API Reference](./docs/api-reference.md) - Full reference with parameters, return types, and usage examples for every exported function
- [React Native Compatibility](./docs/react-native.md) - Integration guide for Expo and bare React Native: polyfills, Metro config, secure storage, and known limitations
- [Transaction Date Formatting](./docs/transaction-timestamps.md) - Format of every `createdAt` timestamp returned by the SDK
- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety
- [Wallet Recovery Limitations](./docs/wallet-recovery-limitations.md) - What happens when keys are lost, what the SDK does not provide, and your application's responsibilities
- [Soroban Vault](./docs/soroban-vault.md) - Savings vault helpers, configuration, and limitations
- [Release Checklist](./docs/release-checklist.md) - Pre-release verification steps for maintainers
- [Architecture Decision Records](./docs/adr/) - Records of significant SDK design decisions and their rationale
- [Support Policy](./docs/support-policy.md) - Supported runtimes, versions, network status, and maintenance expectations
- [Changelog](./CHANGELOG.md) - Track changes across SDK versions

## Package Root Imports

Everything the SDK exposes is available from the package root — this is the
only supported entry point:

```typescript
import { createWallet, sendXLM, getBalance } from "stellar-pocketpay-sdk";
```

Deep imports (e.g. `stellar-pocketpay-sdk/wallet`) are **not supported** and
are not guaranteed to work across versions. Internal helpers that aren't
listed in the Features table above are implementation details and are not
part of the public API.

> [!CAUTION]
> `createWallet` generates a keypair but does not back it up — the SDK never
> persists a secret key anywhere. Losing it means losing access to the
> wallet permanently. Your application (or the user) must save it to secure
> storage right after creation. See
> [Wallet Creation](./docs/getting-started.md#2-wallet-creation),
> [Security Best Practices](./docs/security.md#wallet-backup-responsibility), and
> [Wallet Recovery Limitations](./docs/wallet-recovery-limitations.md).

## Response models

`getTransactions` and `getPayments` return SDK-owned typed models rather than
raw Horizon shapes, so consumers depend on a stable contract that will not
shift if Horizon's response format changes.

`TransactionSummary` fields: `hash`, `ledger`, `createdAt`, `sourceAccount`,
`fee`, `operationCount`, `successful`, `memo?`, `memoType`, `pagingToken`.

`PaymentSummary` fields: `id`, `transactionHash`, `type`, `createdAt`, `from`,
`to`, `amount`, `asset`, `assetIssuer`, `pagingToken`.

Both functions return a paginated list of the form
`{ records, count, nextCursor? }`. `nextCursor` is the paging token of the last
record and is `undefined` when the page is empty; pass it back to fetch the
following page.

```typescript
import { getTransactions } from "stellar-pocketpay-sdk";

const page = await getTransactions(publicKey, 10, "desc");
console.log(page.count, "transactions");
for (const tx of page.records) {
  console.log(tx.hash, tx.createdAt, tx.successful);
}
// page.nextCursor → cursor for the following page
```

The former `TransactionRecord` and `PaymentRecord` names remain exported as
aliases of `TransactionSummary` and `PaymentSummary` for backward
compatibility.

---

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });
