# Wallet Secret Export Policy

This document defines what the PocketPay SDK supports, does not support, and intentionally leaves to consuming applications when handling wallet secret export.

A Stellar secret key grants full control over the associated account and funds. Export functionality therefore has security consequences beyond ordinary data export and must not be inferred from unrelated wallet APIs.

## Policy Summary

The PocketPay SDK does **not** provide a dedicated wallet-secret export workflow.

The SDK provides local wallet primitives that may place a raw Stellar secret key in application memory:

- `createWallet()` returns a `WalletKeypair` containing a newly generated `publicKey` and `secretKey`.
- `importWallet(secretKey)` validates a caller-provided secret key and returns the corresponding `WalletKeypair`.
- `getPublicKey(secretKey)` derives a public key from a secret key already held by the caller.
- Payment and Soroban vault helpers may accept a secret key so they can sign transactions locally.
- `LocalSigner` may hold a caller-provided secret key in memory for transaction signing.

Access to `WalletKeypair.secretKey` is part of the existing local-keypair API. It must not be interpreted as a complete, managed, or secure wallet-export feature.

The SDK does not provide:

- an `exportWallet()`, `exportSecretKey()`, or equivalent dedicated API;
- a wallet-export user interface;
- encrypted backup-file generation;
- clipboard, QR-code, download, printing, or sharing flows;
- mnemonic or recovery-phrase generation;
- mnemonic-to-key derivation;
- cloud synchronization or cross-device backup;
- password-protected wallet archives;
- social, guardian, or multi-party recovery;
- custody, escrow, or secret-recovery services;
- automatic secret-key persistence;
- secure deletion guarantees.

These capabilities are intentionally outside the SDK's current scope.

## Supported Behaviour

### Local Wallet Creation

`createWallet()` generates a Stellar keypair in memory and returns both its public and secret keys to the caller.

```typescript
import { createWallet } from '@axionvera/pocketpay-sdk';

const wallet = createWallet();

console.log(wallet.publicKey);
```

The SDK does not persist, synchronize, encrypt, or retain another copy of `wallet.secretKey`.

Once the returned secret is no longer available to the consuming application, the SDK cannot retrieve or reconstruct it.

A consuming application may use the returned secret to implement its own secure storage, backup, or user-controlled export process. That process is not implemented, secured, reviewed, or validated by the PocketPay SDK.

### Local Wallet Import

`importWallet(secretKey)` accepts an existing Stellar secret key, validates it, derives the corresponding public key, and returns a local `WalletKeypair`.

```typescript
import { importWallet } from '@axionvera/pocketpay-sdk';

const wallet = importWallet(secretKeyFromSecureStorage);

console.log(wallet.publicKey);
```

This is an import operation, not a recovery service.

The caller must already possess the secret key. The SDK does not locate, download, recover, or recreate it.

The SDK does not remember imported wallets and cannot provide the secret again after the consuming application discards it.

### Public-Key Derivation

`getPublicKey(secretKey)` derives a Stellar public key from a caller-provided secret key.

This operation does not export, recover, store, or back up the secret. The caller must already possess the secret key.

### Transaction Signing

Some SDK operations accept or internally hold secret material long enough to sign transactions.

Examples include:

- XLM payments;
- issued-asset payments;
- Soroban vault deposits;
- Soroban vault withdrawals;
- locally backed account signers.

The presence of a secret key in a signing flow does not imply that the signer supports export.

Signing capability and secret extraction are separate security properties.

## Behaviour That Is Not Supported

### Dedicated Secret Export

The SDK does not expose a supported public function such as:

```typescript
exportWallet();
exportSecretKey();
exportMnemonic();
downloadWalletBackup();
```

Applications must not assume that such functionality exists merely because `createWallet()` or `importWallet()` returns a local `WalletKeypair`.

The current APIs expose local secret material only where their documented return values or parameters explicitly include it.

### Secret Extraction From Signers

The SDK does not define a public API for extracting a secret from:

- an `AccountAbstraction`;
- a `Signer`;
- a `LocalSigner`;
- a hardware wallet;
- a hardware security module;
- a passkey-backed signer;
- an MPC signer;
- a remote signing service;
- another external signing implementation.

Consumers must not assume that every signing-capable account has an exportable secret.

An external signer may deliberately keep its private key non-exportable. The SDK's signer interface is designed to permit that security model.

### Export Through Internal APIs

Consumers must not use unsupported techniques to retrieve secret material, including:

- deep imports;
- private-field access;
- runtime inspection;
- object serialization;
- prototype manipulation;
- internal Stellar SDK objects;
- undocumented implementation details;
- reflective access;
- memory inspection.

Only exports available from the package root form the supported public API.

Internal behaviour may change without notice and must not be treated as a stable security contract.

### Recovery Phrases

The SDK works with raw Stellar secret keys and does not:

- generate mnemonic recovery phrases;
- parse mnemonic recovery phrases;
- validate BIP-39 words;
- derive Stellar accounts from mnemonics;
- store mnemonic phrases;
- back up mnemonic phrases;
- restore wallets from mnemonic phrases.

Applications that introduce mnemonic-based recovery are responsible for:

- selecting an appropriate derivation standard;
- reviewing the cryptographic implementation;
- protecting the mnemonic;
- maintaining derivation compatibility;
- documenting account paths;
- preventing accidental disclosure;
- clearly explaining the recovery model to users.

The SDK does not guarantee compatibility with any independently implemented mnemonic scheme.

### Encrypted Backup Files

The SDK does not generate encrypted wallet backup files.

It does not define:

- a backup-file format;
- encryption algorithms;
- password-based key derivation;
- file-integrity protection;
- file-version migration;
- backup-file recovery;
- backup-file deletion;
- password-reset behaviour.

A consuming application that creates encrypted backups owns the design, implementation, testing, migration, and recovery responsibilities for that format.

### Storage and Synchronization

The SDK does not automatically use:

- iOS Keychain;
- Android Keystore;
- Expo SecureStore;
- React Native Keychain;
- browser credential storage;
- encrypted databases;
- hardware security modules;
- cloud key-management systems;
- server-side secrets managers;
- cloud backup;
- device synchronization.

Secure storage, backup, migration, and synchronization remain consumer responsibilities.

## Security Risks

Exporting a wallet secret changes the threat model because every additional copy can independently authorize transactions.

### Unauthorized Disclosure

Anyone who obtains a Stellar secret key can control the associated wallet.

An exposed secret may allow an attacker to:

- sign transactions;
- transfer assets;
- create or remove trustlines;
- interact with smart contracts;
- modify account signers;
- change account thresholds;
- permanently remove funds.

The PocketPay SDK cannot reverse transactions authorized with a compromised secret key.

### Logging and Telemetry Leakage

Secrets may be captured by:

- console logs;
- application logs;
- analytics events;
- crash reports;
- error monitoring;
- distributed tracing;
- debugging tools;
- support diagnostics;
- session-replay tools.

Secret keys must never be included in logs, even temporarily.

Redacting a key is safer than logging the full key, but avoiding secret-key logging entirely is preferred.

### Clipboard Exposure

Clipboard contents may be read by:

- other applications;
- custom keyboards;
- browser extensions;
- clipboard managers;
- device synchronization services;
- remote desktop tools;
- malicious software.

Applications that allow copying a secret key assume responsibility for clipboard warnings, expiration behaviour, cleanup, and platform-specific limitations.

The SDK does not manage the clipboard.

### Screen Exposure

Displayed secrets may be captured through:

- screenshots;
- screen recording;
- shoulder surfing;
- screen sharing;
- remote-support software;
- application previews;
- operating-system task switchers.

The SDK does not provide secure-screen controls or screenshot prevention.

### Network Exposure

A secret key must not be transmitted to:

- application backends;
- analytics providers;
- customer-support platforms;
- unrelated APIs;
- notification services;
- logging services;
- crash-reporting services.

Sending a secret to a remote service transfers wallet-control risk to that service.

The SDK does not require secret keys to be transmitted to PocketPay infrastructure.

### Insecure Storage

The following locations are generally unsuitable for wallet secrets:

- plain-text files;
- source-code files;
- Git repositories;
- ordinary application preferences;
- unencrypted databases;
- browser `localStorage`;
- browser `sessionStorage`;
- shared device folders;
- public cloud drives;
- unprotected environment files;
- application configuration bundles.

Storage suitability depends on the platform, threat model, custody design, and recovery requirements.

### Backup Duplication

Backups may create additional copies with different:

- access permissions;
- retention periods;
- encryption settings;
- geographic locations;
- deletion behaviour;
- account-recovery rules.

Deleting the primary wallet record may not delete copies stored in backups.

### Incomplete Deletion

Removing a wallet from the visible application state may not remove copies from:

- operating-system backups;
- cloud backups;
- logs;
- temporary files;
- caches;
- crash reports;
- clipboard history;
- screenshots;
- exported files;
- synchronized devices.

Applications must not promise secure deletion unless they can verify the complete secret lifecycle.

### User Confusion

Users may incorrectly assume that any of the following can recover a wallet:

- a public key;
- an email address;
- an application password;
- a device PIN;
- a biometric credential;
- a PocketPay account;
- a transaction hash;
- customer support.

None of these values can reconstruct a lost Stellar secret key unless the consuming application has independently built a recovery mechanism that securely retains or derives the secret.

## Consumer Responsibilities

An application that offers wallet-secret export assumes responsibility for the complete export lifecycle.

At minimum, the consuming application should:

1. Decide whether secret export is necessary for its custody and recovery model.
2. Clearly distinguish a public key from a secret key.
3. Explain that possession of the secret grants control of the wallet.
4. Require explicit user intent before revealing or copying secret material.
5. Apply appropriate authentication or reauthentication before sensitive actions.
6. Prevent secrets from reaching logs, analytics, crash reports, support tickets, and error messages.
7. Use platform-appropriate secure storage while the secret is retained.
8. Define how temporary values, cached data, clipboard contents, and visible screens are cleared.
9. Document device-loss, migration, backup, deletion, and recovery behaviour.
10. Test the complete flow for accidental disclosure, including failure paths.
11. Avoid claiming that the SDK can recover, reset, rotate, or reproduce a lost secret.
12. Review accessibility and screen-reader behaviour so secrets are not exposed unexpectedly.
13. Review application backgrounding and task-switcher previews.
14. Avoid exposing secrets by default.
15. Obtain an independent security review before using export functionality with production funds.

Applications should prefer signer-based architectures that avoid exposing raw secret material when their requirements allow it.

Examples include:

- hardware-backed signing;
- hardware wallets;
- remote HSM signing;
- passkey-backed signing;
- MPC signing;
- policy-controlled remote signers.

## Safe Handling Principles

### Minimize Secret Exposure

Secret material should be retained for the shortest practical period.

Applications should avoid passing a complete `WalletKeypair` into components or functions that only need the public key.

Prefer:

```typescript
const publicKey = wallet.publicKey;
```

instead of passing the complete wallet object to unrelated application layers.

### Keep Secrets Out of Logs

Logging and telemetry pipelines must receive only non-secret identifiers, such as the wallet public key, transaction hash, network, operation name, or a sanitized error code.

The SDK provides redaction helpers, but redaction must not be treated as permission to log secret material routinely.

### Keep Secrets Out of Error Messages

Errors should identify the affected operation without embedding secret inputs.

Safe diagnostic information may include:

- public key;
- transaction hash;
- network;
- operation name;
- sanitized error code;
- non-secret request identifiers.

### Avoid Hardcoding Secrets

Do not include real wallet secrets in:

- source code;
- documentation;
- examples;
- test snapshots;
- fixtures committed to version control;
- screenshots;
- issue reports;
- pull-request descriptions.

Examples should use obvious placeholders such as:

```text
S...
```

Placeholders must not resemble usable production credentials.

### Treat Export as a High-Risk Action

A consumer-created export feature should be treated similarly to other high-risk account actions.

Depending on the application threat model, this may include:

- user confirmation;
- reauthentication;
- biometric verification;
- device credential verification;
- warning screens;
- timeout behaviour;
- one-time reveal behaviour;
- cancellation handling;
- audit events that contain no secret material.

The SDK does not implement these controls.

## External and Non-Exportable Signers

The account abstraction layer allows consumers to provide external signers.

Such signers may be backed by:

- hardware wallets;
- hardware security modules;
- operating-system secure hardware;
- passkeys;
- remote signing services;
- multi-party computation;
- other non-exportable key systems.

The SDK relies only on the signer's documented signing behaviour.

It does not require, guarantee, or attempt to obtain the underlying private key.

Applications must use only the capabilities explicitly provided by each signer.

An application must not represent an external account as exportable unless the signer independently documents and guarantees an appropriate export mechanism.

A signing-capable account may intentionally provide:

```text
canSign = true
```

while still providing no secret-export capability.

This is expected and valid behaviour.

## Local Signers

A local signer may hold a secret key in process memory so it can sign transactions.

This does not mean that the SDK provides a supported method for extracting the key from that signer.

Consumers should retain their own authoritative secret source, such as approved secure storage, when their architecture requires later access to a locally held secret.

They must not depend on private signer fields or undocumented object internals.

## Loss and Recovery

The SDK cannot recover a lost Stellar secret key.

There is no:

- password reset;
- support override;
- SDK backdoor;
- central recovery authority;
- automatic cloud copy;
- server-side copy maintained by PocketPay.

If all usable copies of a local wallet secret are lost, the SDK cannot restore access to the account.

Applications that require recovery must design and operate their recovery architecture before funds are placed in the wallet.

See [Wallet Recovery Limitations](./wallet-recovery-limitations.md) for the full recovery model and its limitations.

## Wallet Rotation Is Not Export

Moving funds to a newly created wallet is different from exporting an existing secret key.

An application may choose to:

1. create a new wallet;
2. securely store the new secret;
3. transfer supported assets to the new account;
4. update application records;
5. stop using the previous wallet.

This is an application-controlled migration process.

It does not recover or export the old secret, and it may require additional handling for:

- issued assets;
- trustlines;
- claimable balances;
- account signers;
- smart-contract state;
- sponsorships;
- pending transactions;
- minimum balance requirements.

The SDK does not provide a complete wallet-rotation workflow.

## Guidance for Documentation and Support

Consumer-facing documentation and support processes must not:

- ask users to send secret keys to support personnel;
- request secrets in support forms;
- request secrets in screenshots;
- request secrets through email or chat;
- imply that a public key can restore a wallet;
- imply that PocketPay retains a backup;
- promise recovery that the consuming application has not implemented;
- publish examples containing usable or realistic secret keys;
- instruct users to commit secrets to source control;
- instruct users to store secrets in ordinary browser storage.

Troubleshooting should use:

- public keys;
- transaction hashes;
- sanitized errors;
- network names;
- operation names;
- other non-secret information.

## Unsupported Assumptions

Consumers must not assume that:

- every wallet has an exportable secret;
- every signer has a raw private key available to JavaScript;
- `canSign` means `canExport`;
- PocketPay stores a backup;
- `importWallet()` can discover a lost secret;
- `getPublicKey()` can reverse a public key into a secret;
- an application password is equivalent to a wallet secret;
- deleting a wallet from the UI deletes every secret copy;
- redacted values are safe substitutes for secure storage;
- Testnet-only guidance is sufficient for production custody.

## Mainnet and Production Use

The SDK is currently Testnet-focused and has not been presented as audited or hardened for production custody.

Applications considering Mainnet use must independently review:

- key generation;
- storage;
- export;
- backup;
- recovery;
- transaction signing;
- logging;
- error handling;
- dependency security;
- device compromise;
- server compromise;
- user authentication;
- deletion behaviour.

This document does not certify any consumer-created export flow as production-safe.

## Related Documentation

- [Security Best Practices](./security.md)
- [Wallet Import Safety](./wallet-import-safety.md)
- [Wallet Recovery Limitations](./wallet-recovery-limitations.md)
- [Account Abstraction](./account-abstraction.md)
- [Logging Guidance](./logging.md)
- [React Native Compatibility](./react-native.md)
- [Architecture](./architecture.md)
- [API Reference](./api-reference.md)

## Final Support Statement

Wallet-secret access is available only where an existing local-wallet API explicitly returns or accepts a raw secret key.

A dedicated, security-managed wallet export feature is **not supported by the PocketPay SDK**.

Export interfaces, backup formats, recovery phrases, storage, user authentication, disclosure controls, deletion behaviour, and recovery processes are intentionally the responsibility of the consuming application.

Consumers must not infer secret exportability from:

- the ability to sign transactions;
- access to a public account identity;
- the presence of an account abstraction;
- the presence of a signer;
- the ability to import an already-known secret key.
