# Getting Started with PocketPay SDK

This guide provides a step-by-step walkthrough to get you up and running with the **PocketPay SDK**. You will learn how to install the package, create a new wallet, fund it on the Stellar Testnet, check its balance, and send a test payment.

- [Wallet Lifecycle Example](./examples/create-wallet.ts) - Runnable script: create a wallet, fund it on Testnet, and check the balance

## Runnable example

A complete wallet-lifecycle script lives at
[`examples/create-wallet.ts`](../examples/create-wallet.ts). It creates a
wallet, funds it on Testnet via Friendbot, and checks the balance. Run it with:

```bash
npm run example:wallet
```

The example never prints your secret key. Back up `wallet.secretKey` to secure
storage yourself right after creation; the SDK does not persist it and it
cannot be recovered if lost.

## Prerequisites

Before starting, ensure you have:
- [Node.js](https://nodejs.org/) installed (**version 18.0.0 or higher**).
- A packet manager like `npm`, `yarn`, or `pnpm`.
- A basic understanding of Stellar's public/private key cryptography.

---

## 1. Installation

Install the PocketPay SDK using your preferred package manager:

```bash
npm install @axionvera/pocketpay-sdk
```

Or if you are using Yarn or pnpm:

```bash
yarn add @axionvera/pocketpay-sdk
# or
pnpm add @axionvera/pocketpay-sdk
```

---

## 2. Wallet Creation

Stellar accounts consist of a public key (starting with `G`) and a private/secret key (starting with `S`). The public key is the account address, and the secret key is used to sign transactions and authorize operations.

You can generate a new random wallet keypair using the `createWallet` function:

```typescript
import { createWallet } from '@axionvera/pocketpay-sdk';

const wallet = createWallet();

console.log('🔑 New Stellar Wallet Created:');
console.log(`   Public Key: ${wallet.publicKey}`);
// Don't log wallet.secretKey — persist it to secure storage instead. See the
// backup warning below.
```

### Expected Output
```text
🔑 New Stellar Wallet Created:
   Public Key: GD4...EXAMPLE...PUBLIC...KEY
```

> [!CAUTION]
> **`createWallet` does not back up your keys**
> `createWallet` only *generates* a keypair in memory and returns it — the SDK does not persist, store, or back it up anywhere. Once `wallet.secretKey` goes out of scope without being saved, it is gone permanently and the funds it controls become unrecoverable. There is no "forgot password" flow for a Stellar secret key.
>
> **Your app (or the user) is responsible for backing up `wallet.secretKey` immediately after creation**, for example by:
> - Writing it to encrypted device storage or a secure vault (e.g. OS keychain, HSM).
> - Prompting the user to save it via a recovery-phrase / secret-key export flow before they navigate away.
> - Using environment variables (e.g. via `dotenv`) for server-side scripts and test fixtures — **never** for real user wallets.
>
> Additional handling rules:
> - **Never** hardcode secret keys in your source code.
> - **Never** commit secret keys to version control systems (like Git).
> - **Never** log secret keys (see [Logging Guidance](./logging.md)) — log `publicKey` instead.
> - Anyone who has access to your secret key has full control over your funds.
>
> See [Security Best Practices](./security.md#wallet-backup-responsibility) for more on backup strategies and [Wallet Recovery Limitations](./wallet-recovery-limitations.md) for what happens when keys are lost.

### Restoring a Backed-Up Wallet

Once a secret key has been backed up, use `importWallet` to restore the same wallet in a later session — the SDK does not store or retrieve it for you, so your app must supply the secret key from wherever it was backed up:

```typescript
import { importWallet } from '@axionvera/pocketpay-sdk';

// secretKey retrieved from your app's secure storage / vault, not hardcoded
const wallet = importWallet(secretKeyFromSecureStorage);

console.log('   Public Key:', wallet.publicKey);
```

`importWallet` throws `INVALID_SECRET_KEY` if the value isn't a well-formed Stellar secret key. The same backup and no-logging rules from above apply to imported wallets too.

---

## 3. Testnet Funding

Newly created accounts do not exist on the Stellar network ledger until they are funded with a minimum balance of XLM (the native Stellar asset).

On the **Stellar Testnet**, you can fund a new account for free using **Friendbot** (which provides 10,000 test XLM). Use the `fundTestnetAccount` function:

```typescript
import { fundTestnetAccount } from '@axionvera/pocketpay-sdk';

async function main() {
  const publicKey = 'GD4...'; // Replace with your public key

  console.log('💧 Funding wallet on Testnet via Friendbot...');
  const result = await fundTestnetAccount(publicKey);

  if (result.success) {
    console.log(`✅ Funded successfully!`);
    console.log(`   Transaction Hash: ${result.hash}`);
    console.log(`   Ledger Number:    ${result.ledger}`);
  } else {
    console.error(`❌ Funding failed:`, result.error);
  }
}

main().catch(console.error);
```

### Expected Output
```text
💧 Funding wallet on Testnet via Friendbot...
✅ Funded successfully!
   Transaction Hash: a98b7...
   Ledger Number:    12345
```

---

## 4. Checking Account Balance

To query the balance of any Stellar account, use the `getBalance` function. It returns both the native XLM balance and an array of all active asset balances.

```typescript
import { getBalance } from '@axionvera/pocketpay-sdk';

async function main() {
  const publicKey = 'GD4...'; // Replace with your public key

  console.log('💰 Fetching account balance...');
  const balance = await getBalance(publicKey);

  console.log(`   XLM Balance: ${balance.nativeBalance} XLM`);
  console.log('   All Balances:');
  for (const b of balance.balances) {
    console.log(`     - ${b.asset}: ${b.balance} (Issuer: ${b.issuer || 'None/Native'})`);
  }
}

main().catch(console.error);
```

### Expected Output
```text
💰 Fetching account balance...
   XLM Balance: 10000.0000000 XLM
   All Balances:
     - XLM: 10000.0000000 (Issuer: None/Native)
```

---

## 5. Sending XLM

To send XLM from one account to another, use the `sendXLM` function. You will need:
1. The **Secret Key** of the sending account to sign the transaction.
2. The **Public Key** of the receiving account.
3. The **Amount** of XLM to send (as a string to avoid floating-point inaccuracies).
4. An optional **Memo** (maximum 28 bytes) to attach a short message or ID to the transaction.

> [!NOTE]
> The destination account must already exist on-chain (be funded) before a standard payment transaction can succeed.

```typescript
import { sendXLM } from '@axionvera/pocketpay-sdk';

async function main() {
  const result = await sendXLM({
    sourceSecret: 'SA...', // Sender secret key (starts with S)
    destination: 'GD...',  // Receiver public key (starts with G)
    amount: '100.50',      // Amount in XLM (as a string)
    memo: 'PocketPay payment', // Optional, max 28 bytes
  });

  if (result.success) {
    console.log(`✅ Payment sent successfully!`);
    console.log(`   Transaction Hash: ${result.hash}`);
    console.log(`   Ledger Number:    ${result.ledger}`);
    console.log(`   Fee Charged:      ${result.fee} stroops`);
  }
}

main().catch(console.error);
```

### Expected Output
```text
✅ Payment sent successfully!
   Transaction Hash: f47d...
   Ledger Number:    12347
   Fee Charged:      100 stroops
```

### Validating input before sending

If you are wiring `sendXLM` to a form and want to surface every field error at once instead of throwing on the first failure, use `validateSendXLMParams`. It runs the same input checks `sendXLM` runs internally (secret key format, destination key format, amount format + positivity + 7-decimal precision, memo byte length, and self-payment detection) and returns a structured result. It never submits a transaction and never touches the network.

```typescript
import { validateSendXLMParams, sendXLM } from '@axionvera/pocketpay-sdk';

const params = {
  sourceSecret: form.secret,
  destination: form.destination,
  amount: form.amount,
  memo: form.memo,
};

const check = validateSendXLMParams(params);
if (!check.ok) {
  for (const err of check.errors) {
    // err.code is a stable string like "INVALID_PUBLIC_KEY" or "SELF_PAYMENT".
    // err.field is one of "sourceSecret" | "destination" | "amount" | "memo".
    showFieldError(err.field, err.message);
  }
  return;
}

const result = await sendXLM(params);
```

Branch on `err.code`, not on `err.message`. Codes are part of the SDK's public contract; messages are not.

---

## Complete Example Script

Here is a full TypeScript script that automates the entire flow: creates two wallets, funds them, sends a payment, and verifies the final balances.

Save this as `onboarding.ts`:

```typescript
import {
  createWallet,
  fundTestnetAccount,
  getBalance,
  sendXLM,
} from '@axionvera/pocketpay-sdk';

async function runOnboarding() {
  console.log('🚀 Starting PocketPay SDK Guided Onboarding...\n');

  // 1. Create Sender Wallet
  // In a real app, back up sender.secretKey to secure storage right here —
  // it is never persisted by the SDK and cannot be recovered later.
  console.log('🔑 Creating Sender Wallet...');
  const sender = createWallet();
  console.log(`   Public Key:  ${sender.publicKey}\n`);

  // 2. Create Receiver Wallet
  console.log('🔑 Creating Receiver Wallet...');
  const receiver = createWallet();
  console.log(`   Public Key:  ${receiver.publicKey}\n`);

  // 3. Fund both wallets on Testnet
  console.log('💧 Funding Sender Account via Friendbot...');
  await fundTestnetAccount(sender.publicKey);
  console.log('   ✅ Sender funded.');

  console.log('💧 Funding Receiver Account via Friendbot...');
  await fundTestnetAccount(receiver.publicKey);
  console.log('   ✅ Receiver funded.\n');

  // 4. Check balances before transfer
  let senderBal = await getBalance(sender.publicKey);
  let receiverBal = await getBalance(receiver.publicKey);
  console.log('💰 Balances before transfer:');
  console.log(`   Sender:   ${senderBal.nativeBalance} XLM`);
  console.log(`   Receiver: ${receiverBal.nativeBalance} XLM\n`);

  // 5. Send XLM
  const paymentAmount = '250';
  console.log(`💸 Sending ${paymentAmount} XLM from Sender to Receiver...`);
  const paymentResult = await sendXLM({
    sourceSecret: sender.secretKey,
    destination: receiver.publicKey,
    amount: paymentAmount,
    memo: 'Onboarding Test',
  });

  if (paymentResult.success) {
    console.log(`   ✅ Transfer complete! TX Hash: ${paymentResult.hash}\n`);
  }

  // 6. Check final balances
  senderBal = await getBalance(sender.publicKey);
  receiverBal = await getBalance(receiver.publicKey);
  console.log('💰 Balances after transfer:');
  console.log(`   Sender:   ${senderBal.nativeBalance} XLM`);
  console.log(`   Receiver: ${receiverBal.nativeBalance} XLM\n`);

  console.log('🎉 Guided onboarding flow completed successfully!');
}

runOnboarding().catch((err) => {
  console.error('❌ Onboarding failed:', err);
});
```

You can execute this script using [tsx](https://github.com/privatenumber/tsx):

```bash
npx tsx onboarding.ts
```

---

## Troubleshooting

### `ACCOUNT_NOT_FOUND` (404)
- **Problem**: You receive an error saying `Account not found: GD... It may not be funded yet.` when calling `getBalance` or trying to send a payment.
- **Solution**: A Stellar account does not exist on-chain until it receives its first deposit (minimum 1 XLM). On the Testnet, call `fundTestnetAccount(publicKey)` first. On the Mainnet, send at least 1-2 XLM from another active account or exchange.

### `FRIENDBOT_ERROR` (429)
- **Problem**: Friendbot returns a `429 Too Many Requests` error.
- **Solution**: Friendbot limits how frequently a single IP address or target public key can request funding. Wait 10-15 seconds and try again.

### `INVALID_PUBLIC_KEY` or `INVALID_SECRET_KEY`
- **Problem**: The SDK throws a validation error when processing keys.
- **Solution**: Ensure Stellar public keys are 56 characters long, starting with `G`. Ensure Stellar secret keys are 56 characters long, starting with `S`. Check for accidental whitespace, quotes, or trailing characters.

### Connection/Timeout Errors
- **Problem**: Calls to Horizon or Friendbot timeout or fail with network errors.
- **Solution**: Check your internet connection or verify if the Stellar Testnet services are down. Refer to the [Network Error Handling Guide](./network-errors.md) for advice on implementing retries with backoff.
