# Glossary

Common terms you'll run into while using the PocketPay SDK, explained in plain language with links to relevant SDK modules.

---

## Public Key

Your Stellar account's address — starts with `G`, 56 characters long. Safe to share publicly; it's how others send you payments. Generated (along with a secret key) by [`createWallet`](./getting-started.md#2-wallet-creation).

## Secret Key

The private key that signs transactions and authorizes spending — starts with `S`, 56 characters long. Whoever holds this controls the wallet's funds.

> [!CAUTION]
> Never hardcode or commit secret keys to version control. `createWallet` returns the secret key but does not store it anywhere — backing it up is the consuming app's or user's responsibility. See the [Getting Started guide](./getting-started.md#2-wallet-creation) and [Wallet Backup Responsibility](./security.md#wallet-backup-responsibility) for secure handling.

## Horizon

The REST API that sits between your app and the Stellar network — it handles accounts, transactions, and ledger data. When you call `getBalance` or `sendXLM`, the SDK is quietly talking to Horizon behind the scenes; you never hit it directly.

## Friendbot

A free faucet service that funds new accounts with 10,000 test XLM on **Testnet only** (not available on Mainnet). The SDK wraps this via [`fundTestnetAccount`](./getting-started.md#3-testnet-funding).

## Testnet

A full practice copy of the Stellar network, funded with fake XLM instead of real money. Build and break things here before touching Mainnet. The SDK defaults to Testnet unless you configure otherwise (see [`configuration.md`](./configuration.md)).

## Soroban

Stellar's Rust-based smart contract platform, separate from regular Stellar payments and running on its own RPC endpoints. Contracts like the [Savings Vault](./soroban-vault.md) are built on Soroban.

## Vault

Short for the **PocketPay Savings Vault**, a Soroban smart contract that tracks user balances via `depositToVault`, `withdrawFromVault`, and `getVaultBalance`.

> [!NOTE]
> The vault currently does **internal bookkeeping only** — it does not custody real tokens. Depositing/withdrawing changes a stored number, not actual XLM movement. See [`soroban-vault.md`](./soroban-vault.md#current-contract-limitations) for full details before building on top of it.

## Memo

An optional short message (max 28 bytes) attached to a payment — often used to identify a transaction's purpose or link it to an order/invoice ID. Passed as a parameter in [`sendXLM`](./getting-started.md#5-sending-xlm).

## Stroops

The smallest unit of XLM — like a "cent" but far smaller. **1 XLM = 10,000,000 stroops.** Transaction fees are quoted in stroops (e.g. `100 stroops` per typical payment), while balances and amounts in this SDK are shown in XLM for readability.