# Account Abstraction

This document explains the account abstraction layer introduced in PocketPay
SDK, covering the motivation, the model, the exported API, and usage examples
for both local wallets and external signers.

## Background

Before this layer existed the SDK expressed "an account" as a raw `WalletKeypair`
— a plain object containing both `publicKey` and `secretKey`. That coupling made
it easy to accidentally pass secret material through code paths that only needed a
public key, and it left no clean extension point for signers that are not backed by
a locally-held secret (hardware wallets, remote HSMs, passkey-based signers).

The account abstraction layer solves both problems by splitting the concept of
_identity_ from the concept of _signing capability_, and by expressing signing
behind a narrow interface that any implementation can satisfy.

## Concepts

### AccountIdentity

The public, shareable face of a Stellar account. It carries only:

| Field       | Type     | Description                              |
|-------------|----------|------------------------------------------|
| `publicKey` | `string` | The Stellar public key (G...) for this account |

`AccountIdentity` is safe to log, store, and pass to any read-only operation.
It contains no secret material.

### Signer

An interface for anything that can sign a Stellar transaction:

```ts
interface Signer {
  readonly publicKey: string;
  sign(
    transaction: Transaction | FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<Transaction | FeeBumpTransaction>;
}
```

`sign()` is async so that both synchronous (local keypair) and asynchronous
(hardware wallet, remote HSM) implementations satisfy the same contract.

### LocalSigner

The built-in `Signer` implementation for in-memory Stellar keypairs. It wraps
a `Keypair` from `@stellar/stellar-sdk` and signs transactions synchronously
(returning an already-resolved `Promise`).

### AccountAbstraction

The central handle that combines an `AccountIdentity` with an optional
`Signer`:

| Property    | Type                    | Description                                       |
|-------------|-------------------------|---------------------------------------------------|
| `identity`  | `AccountIdentity`       | The public key identity (read-only)               |
| `signer`    | `Signer \| undefined`   | The attached signer, or `undefined` for read-only |
| `canSign`   | `boolean`               | `true` when a `Signer` is attached                |
| `publicKey` | `string`                | Shorthand for `identity.publicKey`                |
| `sign()`    | method                  | Signs a transaction via the attached signer       |

## API

All symbols are exported from the package root.

### Factory functions

```ts
import {
  createReadOnlyAccount,
  createLocalAccount,
  createAccountWithSigner,
  createLocalSigner,
} from 'stellar-pocketpay-sdk';
```

#### `createReadOnlyAccount(publicKey: string): AccountAbstraction`

Creates a read-only account from a Stellar public key. `canSign` is `false`;
calling `sign()` throws. Use this for balance queries, transaction history, and
watch-only displays.

```ts
const observer = createReadOnlyAccount('GXXX...');
console.log(observer.publicKey);  // G...
console.log(observer.canSign);    // false
```

#### `createLocalAccount(secretKey: string): AccountAbstraction`

Creates a signing-capable account from a Stellar secret key. The public key is
derived automatically. `canSign` is `true`; `sign()` uses the local keypair.

```ts
const account = createLocalAccount('SXXX...');
console.log(account.publicKey);  // derived G...
console.log(account.canSign);    // true

const signed = await account.sign(tx, Networks.TESTNET);
```

#### `createAccountWithSigner(identity: AccountIdentity, signer?: Signer): AccountAbstraction`

Creates an account from an explicit identity and an optional signer. When
`signer` is omitted the account is read-only. Use this to attach custom signer
implementations (hardware wallets, remote HSMs, etc.).

```ts
// Read-only via explicit identity
const readOnly = createAccountWithSigner({ publicKey: 'GXXX...' });

// Custom signer
const account = createAccountWithSigner({ publicKey: 'GXXX...' }, myHardwareWalletSigner);
```

#### `createLocalSigner(secretKey: string): LocalSigner`

Standalone factory for a `LocalSigner` without constructing a full
`AccountAbstraction`. Useful when you only need the signer half.

```ts
const signer = createLocalSigner('SXXX...');
const signed = await signer.sign(tx, Networks.TESTNET);
```

### Classes and interfaces

| Export               | Kind        | Description                                    |
|----------------------|-------------|------------------------------------------------|
| `AccountIdentity`    | `interface` | Public key identity (type only)                |
| `Signer`             | `interface` | Signing capability contract (type only)        |
| `LocalSignerConfig`  | `interface` | Config for `LocalSigner` (type only)           |
| `AccountAbstraction` | `interface` | Full account handle (type only)                |
| `LocalSigner`        | `class`     | In-memory keypair signer implementation        |

## Relationship to existing wallet helpers

The account abstraction layer sits _alongside_ the existing wallet helpers — it
does not replace them. The mapping is:

| Before                        | Equivalent account abstraction                    |
|-------------------------------|---------------------------------------------------|
| `createWallet()` (keypair)    | `createLocalAccount(secretKey)` for a full handle |
| `importWallet(secretKey)`     | `createLocalAccount(secretKey)`                   |
| bare `publicKey` string       | `createReadOnlyAccount(publicKey)`                |

`createWallet()` still returns a `WalletKeypair` for callers that only need the
raw keys. The account abstraction layer is an additional model, not a migration.

## Usage examples

### Read-only balance check

```ts
import { createReadOnlyAccount, getBalance } from 'stellar-pocketpay-sdk';

const account = createReadOnlyAccount('GXXX...');
const balance = await getBalance(account.publicKey);
console.log(balance.nativeBalance);
```

### Signing a transaction with a local wallet

```ts
import {
  createLocalAccount,
  getHorizonServer,
  getNetworkPassphrase,
  resolveConfig,
} from 'stellar-pocketpay-sdk';
import * as StellarSDK from '@stellar/stellar-sdk';

const account = createLocalAccount('SXXX...');
const config = resolveConfig();
const server = getHorizonServer();

// Load the on-chain account to get the current sequence number
const sourceAccount = await server.loadAccount(account.publicKey);

// Build the transaction
const tx = new StellarSDK.TransactionBuilder(sourceAccount, {
  fee: StellarSDK.BASE_FEE,
  networkPassphrase: getNetworkPassphrase(config.network),
})
  .addOperation(
    StellarSDK.Operation.payment({
      destination: 'GDESTINATION...',
      asset: StellarSDK.Asset.native(),
      amount: '10',
    }),
  )
  .setTimeout(30)
  .build();

// Sign via the abstraction layer
const signed = await account.sign(tx, getNetworkPassphrase(config.network));

// Submit
const result = await server.submitTransaction(signed as StellarSDK.Transaction);
console.log('Submitted:', result.hash);
```

### Plugging in a custom external signer

```ts
import {
  createAccountWithSigner,
  type Signer,
} from 'stellar-pocketpay-sdk';
import type { Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';

// Example: a bridge to a hardware wallet that presents the transaction
// to the user and returns it signed.
const hardwareWalletSigner: Signer = {
  publicKey: 'GXXX...', // must match the account on-chain

  async sign(tx: Transaction | FeeBumpTransaction, _networkPassphrase: string) {
    // Send the XDR to the hardware wallet and wait for user approval
    const signedXdr = await myHardwareWallet.signTransaction(tx.toXDR());
    return Transaction.fromXDR(signedXdr, _networkPassphrase);
  },
};

const account = createAccountWithSigner(
  { publicKey: 'GXXX...' },
  hardwareWalletSigner,
);
// From this point, account.sign() delegates to the hardware wallet
```

## Security notes

- `AccountIdentity` carries no secret material and is safe to pass to any
  context that only reads the account.
- `LocalSigner` holds a Stellar `Keypair` in memory. Ensure the `LocalSigner`
  instance is discarded when no longer needed so the secret key can be
  garbage-collected.
- Never log or transmit the `secretKey` value. See [Security Best Practices](./security.md).
- For production key management, prefer hardware wallets or remote HSMs over
  `LocalSigner`. The `Signer` interface is designed to accommodate these.

## Future extensions

The `Signer` interface intentionally has a minimal surface so extensions are
low-friction:

- **Multisig co-signers**: collect partial signatures from multiple `Signer`
  instances and assemble them before submission.
- **MPC signers**: threshold-signature schemes where no single party holds the
  full private key.
- **Passkey / WebAuthn signers**: browser-based signing via FIDO2 credentials.
- **Ledger / Trezor bridges**: hardware wallet bridges that present the
  transaction on the device display and return the signed envelope.

None of these require changes to the `AccountAbstraction` interface. A custom
`Signer` implementation just needs to satisfy the two-field interface.
