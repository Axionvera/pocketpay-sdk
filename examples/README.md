# SDK examples

This directory contains runnable TypeScript examples for the PocketPay SDK. All
current examples target Stellar Testnet and require external network access.
They may create accounts or submit transactions, so do not use Mainnet keys.

## Prerequisites

- Node.js 18 or newer
- Dependencies installed with `npm install`
- Internet access to Stellar Testnet services
- `STELLAR_NETWORK=testnet` (the default when it is unset)
- For vault examples, a deployed Testnet savings-vault contract and its
  56-character contract ID in `VAULT_CONTRACT_ID`

Optional network settings such as custom Horizon and Soroban RPC URLs are
documented in [`.env.example`](../.env.example). Shell commands below use
POSIX syntax; in PowerShell, set the vault contract ID first with
`$env:VAULT_CONTRACT_ID = "C..."`.

## Examples

### Create and fund a wallet

- **Path:** [`examples/create-wallet.ts`](./create-wallet.ts)
- **Demonstrates:** Creating a Stellar keypair, funding its public account
  through Friendbot, and reading its balances without printing the secret key.
- **Run:** `npm run example:wallet` (or `npx tsx examples/create-wallet.ts`)
- **Expected output:** A new public key, confirmation that its secret key is
  hidden, a Friendbot transaction hash, and the funded account's XLM and asset
  balances.
- **Network:** **Required — Testnet Friendbot and Horizon.**

### Get transactions and payments

- **Path:** [`examples/get-transactions.ts`](./get-transactions.ts)
- **Demonstrates:** Reading and formatting the five most recent transactions
  and payments for a public account, newest first.
- **Run:** `npx tsx examples/get-transactions.ts`
- **Expected output:** Transaction and payment counts followed by summaries
  (hashes, ledger/fee information, participants, amounts, and timestamps), or
  a no-records message. Replace the `PUBLIC_KEY` constant with a funded Testnet
  account to see its history.
- **Network:** **Required — Testnet Horizon.**

### Send XLM

- **Path:** [`examples/send-xlm.ts`](./send-xlm.ts)
- **Demonstrates:** Creating sender and receiver wallets, funding both through
  Friendbot, sending 25 XLM, and checking their final balances.
- **Run:** `npx tsx examples/send-xlm.ts`
- **Expected output:** Both public keys, funding confirmations, the submitted
  payment's transaction hash, ledger, and fee, then the final XLM balances.
- **Network:** **Required — Testnet Friendbot and Horizon.**

### Query a vault balance

- **Path:** [`examples/vault-balance.ts`](./vault-balance.ts)
- **Demonstrates:** Validating vault configuration, creating and funding a
  wallet, and making a read-only savings-vault balance query.
- **Run:** `VAULT_CONTRACT_ID=C... npx tsx examples/vault-balance.ts`
- **Expected output:** The new wallet address, funding confirmation, and its
  available vault balance (normally zero because this example makes no
  deposit). Configuration or SDK errors are printed with a useful message.
- **Network:** **Required — Testnet Friendbot, Horizon, and Soroban RPC.**
- **Additional prerequisite:** `VAULT_CONTRACT_ID` must identify a deployed
  Testnet savings-vault contract.

### Deposit to and withdraw from a vault

- **Path:** [`examples/vault-operations.ts`](./vault-operations.ts)
- **Demonstrates:** Creating and funding a wallet, depositing 100 XLM into a
  savings vault, reading the vault balance, and withdrawing 50 XLM.
- **Run:** `VAULT_CONTRACT_ID=C... npx tsx examples/vault-operations.ts`
- **Expected output:** The wallet address and funding confirmation, a deposit
  transaction hash, the resulting vault balance, and a withdrawal transaction
  hash (or an operation-specific failure message).
- **Network:** **Required — Testnet Friendbot, Horizon, and Soroban RPC.**
- **Additional prerequisite:** `VAULT_CONTRACT_ID` must identify a deployed
  Testnet savings-vault contract. The vault integration is pre-release and does
  not move real XLM; see the [Soroban vault guide](../docs/soroban-vault.md).

Network responses and generated account data vary between runs, so the output
descriptions above summarize the shape of a successful run rather than exact
values.
