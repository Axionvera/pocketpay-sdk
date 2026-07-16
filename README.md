# Stellar PocketPay SDK

> Reusable TypeScript helper package for the Stellar PocketPay mobile app and other Stellar Testnet applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-brightgreen.svg)](https://stellar.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Project Status

**This SDK is in active development and is not production-ready.**

The current focus is on Stellar Testnet wallet helpers, XLM payments, transaction queries, and early Soroban vault utilities. The vault features are experimental and depend on a separate smart contract repository. Production deployments should not rely on this SDK until a stable release is announced.

---

## Ecosystem

This SDK is one piece of the PocketPay project. It provides the TypeScript client layer that sits between the mobile app and the Stellar network.

| Repository | Purpose |
| --- | --- |
| **stellar-pocketpay-sdk** (this package) | TypeScript SDK for wallet operations, payments, transaction queries, and vault contract interactions |
| [Axionvera/pocketpay-mobile](https://github.com/Axionvera/pocketpay-mobile) | React Native mobile app that consumes this SDK |
| [Axionvera/pocketpay-contracts](https://github.com/Axionvera/pocketpay-contracts) | Soroban smart contracts (savings vault) deployed to Stellar Testnet |

The mobile app imports this SDK to handle all Stellar network communication. The vault contract functions in this SDK call into the contracts deployed from the `pocketpay-contracts` repository.

---

## Features

| Module         | Functions                                          |
| -------------- | -------------------------------------------------- |
| **Wallet**     | `createWallet`, `importWallet`, `getPublicKey`, `getBalance`, `fundTestnetAccount` |
| **Payments**   | `sendXLM`                                          |
| **Transactions** | `getTransactions`, `getPayments`                 |
| **Soroban**    | `depositToVault`, `withdrawFromVault`, `getVaultBalance` |
| **Config**     | `resolveConfig`, `getHorizonServer`, `getNetworkPassphrase` |
| **Utils**      | `validatePublicKey`, `validateSecretKey`, `validateAmount`, `stroopsToXLM`, `xlmToStroops`, `truncateAddress` |

---

## Installation

```bash
npm install stellar-pocketpay-sdk
```

Or clone and link locally:

```bash
git clone https://github.com/Axionvera/stellar-pocketpay-sdk.git
cd stellar-pocketpay-sdk
npm install
npm run build
npm link
```

---

## Quick Start

```typescript
import {
  createWallet,
  fundTestnetAccount,
  getBalance,
  sendXLM,
} from 'stellar-pocketpay-sdk';

// 1. Create a wallet
const wallet = createWallet();
console.log('Public Key:', wallet.publicKey);

// 2. Fund on testnet
await fundTestnetAccount(wallet.publicKey);

// 3. Check balance
const balance = await getBalance(wallet.publicKey);
console.log('XLM:', balance.nativeBalance);

// 4. Send XLM
const result = await sendXLM({
  sourceSecret: wallet.secretKey,
  destination: 'GDEST...',
  amount: '10',
  memo: 'coffee',
});
console.log('TX Hash:', result.hash);
```

---

## Project Structure

```
stellar-pocketpay-sdk/
├── src/
│   ├── config/        # Network configuration & server factories
│   ├── wallet/        # Keypair management, balances, funding
│   ├── payments/      # XLM payment transactions
│   ├── transactions/  # Transaction & payment history queries
│   ├── soroban/       # Savings vault contract interactions
│   ├── types/         # All TypeScript type definitions
│   ├── utils/         # Validation, formatting, error helpers
│   └── index.ts       # Barrel export
├── tests/             # Vitest test suites
├── examples/          # Runnable example scripts
├── .env.example       # Environment variable template
├── tsconfig.json      # TypeScript configuration
├── vitest.config.ts   # Test configuration
└── package.json
```

---

## Configuration

The SDK defaults to **Stellar Testnet**. There is currently no support for Stellar Mainnet. All account funding, payments, and vault operations target the Testnet network.

Configure via environment variables or programmatic overrides:

```bash
# .env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VAULT_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Or pass config directly:

```typescript
import { getBalance } from 'stellar-pocketpay-sdk';

const balance = await getBalance('GABCD...', {
  network: 'testnet',
  horizonUrl: 'https://custom-horizon.example.com',
});
```

---

## API Reference

### Wallet

#### `createWallet(): WalletKeypair`
Creates a new random Stellar keypair. Does **not** activate it on-chain.

#### `importWallet(secretKey: string): WalletKeypair`
Imports an existing wallet from a secret key.

#### `getPublicKey(secretKey: string): string`
Derives the public key from a secret key.

#### `getBalance(publicKey: string, config?): Promise<AccountBalance>`
Fetches all asset balances for an account. Returns a `nativeBalance` shortcut for XLM.

#### `fundTestnetAccount(publicKey: string): Promise<FundResult>`
Funds an account with 10,000 XLM via Friendbot. **Testnet only.**

### Payments

#### `sendXLM(params: SendXLMParams, config?): Promise<PaymentResult>`
Sends XLM from one account to another. Supports optional memo text (max 28 bytes).

```typescript
interface SendXLMParams {
  sourceSecret: string;
  destination: string;
  amount: string;
  memo?: string;
}
```

### Transactions

#### `getTransactions(publicKey, limit?, order?, config?): Promise<TransactionList>`
Fetches recent transactions for an account.

#### `getPayments(publicKey, limit?, order?, config?): Promise<PaymentList>`
Fetches recent payment operations for an account.

### Soroban Vault (Experimental)

These functions interact with the savings vault smart contract defined in [Axionvera/pocketpay-contracts](https://github.com/Axionvera/pocketpay-contracts). The vault integration is in early development and may change without notice.

#### `depositToVault(params: VaultDepositParams, config?): Promise<VaultResult>`
Deposits XLM into the savings vault smart contract.

#### `withdrawFromVault(params: VaultWithdrawParams, config?): Promise<VaultResult>`
Withdraws XLM from the savings vault smart contract.

#### `getVaultBalance(params: VaultBalanceParams, config?): Promise<VaultResult>`
Queries the vault balance for a user.

---

## Examples

Run examples directly with `tsx`:

```bash
# Create a wallet, fund it, check balance
npx tsx examples/create-wallet.ts

# Send XLM between two accounts
npx tsx examples/send-xlm.ts

# Vault operations (requires deployed contract)
VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-operations.ts
```

---

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check without emitting
npm run lint
```

---

## Error Handling

All SDK functions throw `PocketPayError` with structured error information:

```typescript
import { getBalance, PocketPayError } from 'stellar-pocketpay-sdk';

try {
  const balance = await getBalance('GINVALID...');
} catch (error) {
  if (error instanceof PocketPayError) {
    console.error(error.code);      // "INVALID_PUBLIC_KEY"
    console.error(error.message);   // Human-readable message
    console.error(error.statusCode); // HTTP status (if applicable)
  }
}
```

### Error Codes

| Code                    | Description                          |
| ----------------------- | ------------------------------------ |
| `INVALID_PUBLIC_KEY`    | Invalid Stellar public key format    |
| `INVALID_SECRET_KEY`    | Invalid Stellar secret key format    |
| `INVALID_AMOUNT`        | Non-positive or non-numeric amount   |
| `INVALID_AMOUNT_PRECISION` | More than 7 decimal places        |
| `INVALID_MEMO`          | Memo exceeds 28-byte limit           |
| `SELF_PAYMENT`          | Source and destination are the same   |
| `ACCOUNT_NOT_FOUND`     | Account doesn't exist on network     |
| `TESTNET_ONLY`          | Operation only available on testnet  |
| `PAYMENT_FAILED`        | Transaction rejected by network      |
| `MISSING_CONTRACT_ID`   | Vault contract ID not provided       |

---

## Security

> ⚠️ **Never hardcode secret keys.** Always use environment variables or function parameters.

- Secret keys should be stored securely (e.g., encrypted storage, OS keychain)
- The `.env` file is gitignored — use `.env.example` as a template
- All examples use dynamically generated keys

---

## License

MIT © Stellar PocketPay
