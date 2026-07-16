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

- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety

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

The SDK defaults to **Stellar Testnet**. Configure via environment variables or programmatic overrides:

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

### Soroban Vault

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
