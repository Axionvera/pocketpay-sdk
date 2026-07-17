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

- [Getting Started](./docs/getting-started.md) - Step-by-step guide to install, create wallets, fund accounts, check balances, and send payments
- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety
- [Soroban Vault](./docs/soroban-vault.md) - Savings vault helpers, configuration, and limitations
- [Release Checklist](./docs/release-checklist.md) - Pre-release verification steps for maintainers
- [Vault Balance Example](./examples/vault-balance.ts) - Query a vault balance (read-only, no deposit needed)
- [Vault Operations Example](./examples/vault-operations.ts) - Full deposit, balance check, and withdraw flow

## Package Root Imports

Everything the SDK exposes is available from the package root — this is the
only supported entry point:

```typescript
import { createWallet, sendXLM, getBalance } from 'stellar-pocketpay-sdk';
```

Deep imports (e.g. `stellar-pocketpay-sdk/wallet`) are **not supported** and
are not guaranteed to work across versions. Internal helpers that aren't
listed in the Features table above are implementation details and are not
part of the public API.

---

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });
