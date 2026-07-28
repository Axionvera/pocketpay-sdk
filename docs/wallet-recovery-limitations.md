# Wallet Recovery Limitations

Understanding what happens when wallet secrets are lost, what the PocketPay SDK can and cannot do, and who is responsible for keeping funds accessible.

## The Hard Truth

**A Stellar secret key that is lost cannot be recovered.** There is no password reset, no customer support override, no central authority, and no backdoor. This is not a limitation of the PocketPay SDK — it is a fundamental property of Stellar and every other self-custody blockchain protocol.

When `createWallet()` generates a keypair, or `importWallet(secretKey)` derives a keypair, the `secretKey` exists only in memory within the object returned to your application. The SDK does not send it anywhere, store it anywhere, or keep a copy. If that value is lost, the wallet and all funds it holds become permanently inaccessible.

### Local Wallet Generation & Import Boundary

The SDK provides two local, stateless key management primitives:

```typescript
import { createWallet, importWallet } from "stellar-pocketpay-sdk";

// 1. Local Generation
const wallet = createWallet();
// SDK returns: { publicKey: "G...", secretKey: "S..." }
// At this exact moment, wallet.secretKey exists ONLY in your variable.

// 2. Local Import
const importedWallet = importWallet("S...");
// SDK validates key format and derives keypair in memory.
```

**SDK Boundary:** The SDK returns the `WalletKeypair` object directly to the caller. From that line of code forward, saving the `secretKey` into OS secure storage or prompting the user for backup is entirely the consuming application's responsibility.


## What the SDK Does NOT Provide

The PocketPay SDK is a stateless library. It intentionally does not include any of the following:

| Capability | Why the SDK doesn't provide it |
|---|---|
| **Key escrow / backup** | Storing keys on behalf of users would make the SDK a high-value attack target and create a custodial relationship with legal and security implications. |
| **Password-based recovery** | There is no server-side mapping between a password and a secret key. A password only helps if the key is stored somewhere — the SDK never stores it. |
| **Social / multi-party recovery** | Splitting a key across guardians (e.g. Shamir's Secret Sharing) is a complex protocol that belongs in the consuming application, not a payment SDK. |
| **Cloud sync or backup** | Syncing keys to iCloud, Google Drive, or any cloud service introduces attack surface. The consuming app decides whether this trade-off is acceptable for its users. |
| **Seed phrase generation** | The SDK works with raw Stellar secret keys (`S...`). BIP-39 mnemonic flows, if desired, are the consuming application's responsibility. |
| **Multi-signature recovery** | Setting up a signer that can recover access (e.g. a server-side recovery key) is a Stellar protocol-level operation. The SDK's `account` module can help build this, but the design and security model are the app's responsibility. |

If your application needs any of these features, you must build them on top of the SDK. The SDK provides the primitives (`createWallet`, `importWallet`, signer management); your application provides the recovery architecture.

## When Secrets Are Lost

### Common Loss Scenarios

| Scenario | What happens | Prevention |
|---|---|---|
| **App uninstalled** | If the secret key was only in memory or app-local storage, it is gone. | Persist to OS secure storage (Keychain / Keystore) before the user navigates away from the creation screen. |
| **Device lost or stolen** | If the key was in secure storage protected by biometrics, it remains on the lost device. If the user had no backup, the key is inaccessible on the new device. | Prompt users to back up their secret key or recovery phrase during wallet creation. |
| **Factory reset / wipe** | OS keychain data is typically wiped. | Encourage users to export or back up their key before resetting. |
| **Browser data cleared** | Web apps using IndexedDB or localStorage lose the key. | Use the Web Crypto API with non-extractable keys where possible, or prompt for a backup. |
| **User forgets password to encrypted backup** | The encrypted backup is useless without the password. | There is no perfect solution — this is the fundamental trade-off of self-custody. |
| **Developer deletes the key from code / config** | For server-side wallets, the key is gone unless it was backed up elsewhere. | Use a secrets manager. Never store keys only in code or env files. |

### What You Cannot Do After Key Loss

- **Reverse transactions** made by whoever obtained the key.
- **Freeze the account** (Stellar accounts have no freeze mechanism for native XLM).
- **Contact Stellar Development Foundation** to restore access (they cannot).
- **Contact PocketPay support** to restore access (the SDK never had the key).
- **Brute-force the key** (256-bit keyspace is computationally infeasible).

### What You Can Do

- **Prevent the loss** by implementing proper backup flows in your application.
- **Use multi-sig** — set up a secondary signer on the Stellar account that can be used for recovery. The SDK's `account` module supports signer operations.
- **Set up a recovery key** — generate a second keypair stored separately (e.g. in a hardware security module or with a trusted third party) and add it as a signer on the account.

## Responsibilities

### Your Application Is Responsible For

1. **Persisting the secret key** to platform-appropriate secure storage immediately after `createWallet()` or `importWallet()` returns.
2. **Prompting the user** to back up their key or recovery phrase during the wallet creation flow.
3. **Protecting the key** at rest (encryption, secure enclaves) and in transit (never over the network).
4. **Handling device migration** — ensuring the key transfers securely or that the user has an out-of-band backup.
5. **Cleaning up** — removing the key from storage when the user removes a wallet or signs out.
6. **Communicating clearly** to users that losing their key means losing their funds permanently.
7. **Designing the recovery model** — whether that's a backup phrase, a recovery key, social recovery, or simply "you are responsible for your own key."

### The User Is Responsible For

1. **Keeping their backup safe** — writing down a recovery phrase and storing it offline, or securely exporting their secret key.
2. **Not sharing their secret key** with anyone, including support staff, friends, or family.
3. **Understanding that self-custody means self-responsibility** — there is no bank or company that can reverse a mistake.

### The SDK Is Responsible For

1. **Generating cryptographically secure keypairs.**
2. **Never persisting, logging, or transmitting secret keys.**
3. **Providing clear documentation** about what it does and does not do (this document).
4. **Validating inputs** to prevent accidental misuse (e.g. rejecting malformed keys).

## Platform-Specific Guidance

### Mobile (iOS / Android)

- **iOS:** Use the Keychain Services API with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for secret key storage. Data in the Keychain is not included in unencrypted iTunes backups by default — verify backup behavior.
- **Android:** Use the Android Keystore with `setUnlockedDeviceRequired(true)` where supported. On older devices without hardware-backed Keystore, consider encrypting the key with a user-derived passphrase before storing.
- **React Native:** See the [React Native Compatibility](./react-native.md) guide for secure storage options (Expo SecureStore, react-native-keychain).
- **Cross-platform:** If your app supports both platforms, abstract the secure storage layer behind a consistent interface so the wallet creation and backup flows are identical from the user's perspective.

### Web

- **Web Crypto API:** Generate keys with `extractable: false` when possible. Non-extractable keys cannot be exported by JavaScript, reducing the impact of XSS — but they are lost when the browser storage is cleared.
- **IndexedDB:** The only persistent storage available to Web Crypto keys. Data survives page reloads but not browser "clear site data" or Incognito sessions.
- **localStorage / sessionStorage:** **Not suitable** for secret keys. These are accessible to any script on the same origin and are trivially exfiltrated by XSS.
- **User prompting:** Web apps should strongly encourage users to download or copy their secret key during creation, since browser storage is fragile.

## Frequently Asked Questions

**Q: Can PocketPay recover my wallet if I lost my secret key?**
A: No. The SDK never had your key. It was generated on your device and never left it (if the integration was done correctly).

**Q: Can I reset my secret key like a password?**
A: No. A Stellar secret key is not a password — it is a cryptographic key that controls the account. There is no reset mechanism.

**Q: What if someone stole my device?**
A: If your key was in secure storage protected by biometrics or a device PIN, it is likely safe from casual theft. However, if you had no backup, you cannot access the wallet from a new device. Consider setting up a recovery signer on your Stellar account for this scenario.

**Q: Can I use a recovery phrase (seed phrase) with PocketPay?**
A: The SDK works with raw Stellar secret keys (`S...`). If you want to offer mnemonic-based recovery (BIP-39), you must implement the mnemonic-to-key derivation in your application.

**Q: Should I store the key on my server for backup?**
A: This depends on your threat model. Storing keys server-side makes your server a high-value target. If you do this, encrypt the keys at rest, use a hardware security module (HSM) if possible, and understand that you are taking on custodial responsibility. Most applications should let the user hold their own key.

**Q: What about multi-signature accounts?**
A: Stellar supports multi-sig natively. You can set up a secondary signer (e.g. a recovery key held by the user or a trusted party) that can add a new primary signer if the original is lost. The SDK's `account` module provides the primitives to manage signers. Designing the multi-sig recovery flow is your application's responsibility.
