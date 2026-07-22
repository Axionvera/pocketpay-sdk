# Wallet Recovery Limitations

This document explains what happens when a Stellar secret key is lost, what the PocketPay SDK can and cannot do about it, and how your application should protect its users from permanent loss of funds.

> [!CAUTION]
> **There is no recovery mechanism for a lost Stellar secret key.** Unlike a bank account or a custodial crypto wallet, there is no customer support line, no password reset, no master key, and no undo. If the secret key is gone, the funds it controls are gone — permanently.

---

## Table of Contents

- [How Stellar Keys Work](#how-stellar-keys-work)
- [What the SDK Does NOT Provide](#what-the-sdk-does-not-provide)
- [Common Loss Scenarios](#common-loss-scenarios)
- [Who Is Responsible](#who-is-responsible)
  - [Your Responsibility (the App Developer)](#your-responsibility-the-app-developer)
  - [Your Users' Responsibility](#your-users-responsibility)
- [Platform-Specific Guidance](#platform-specific-guidance)
  - [Mobile (iOS / Android)](#mobile-ios--android)
  - [Web (Browser)](#web-browser)
  - [Backend / Server-Side](#backend--server-side)
- [What to Tell Your Users](#what-to-tell-your-users)
- [FAQ](#faq)
- [Related Docs](#related-docs)

---

## How Stellar Keys Work

Stellar uses public-key cryptography (Ed25519):

- **Public key** (`G...`): The account address. Safe to share. Used to receive funds and query balances.
- **Secret key** (`S...`): The private signing key. Whoever holds it has full control over the account — to send payments, merge accounts, manage trustlines, etc.

The `createWallet` function generates a random keypair in memory and returns both keys. The SDK does **not** store, persist, or back up either key. Your application must handle storage.

```
Secret key lost → No way to sign transactions → Funds are permanently locked
```

There is no on-chain recovery path. The Stellar network has no concept of account recovery, key rotation (for basic accounts), or social recovery. The cryptographic guarantee is absolute: without the secret key, the funds cannot move.

---

## What the SDK Does NOT Provide

The PocketPay SDK is a stateless library. The following features are **deliberately out of scope**:

| Feature | Status | Why |
|---|---|---|
| Key persistence / storage | ❌ Not provided | SDK is stateless; storage is the app's responsibility |
| Password / PIN protection | ❌ Not provided | SDK does not manage user authentication |
| Key escrow or backup service | ❌ Not provided | No server-side key custody |
| Multi-signature recovery | ❌ Not provided | SDK targets basic single-signer Stellar accounts |
| Social recovery / guardians | ❌ Not provided | Requires smart contract infrastructure beyond SDK scope |
| Cloud sync of keys | ❌ Not provided | Would introduce a single point of compromise |
| Key rotation | ❌ Not provided | Stellar basic accounts do not support signer rotation without pre-configuration |
| "Forgot password" flow | ❌ Not possible | No master key or recovery secret exists in the protocol |

> [!NOTE]
> If your product requires any of these features, you must implement them on top of the SDK. For example, you could build a Shamir's Secret Sharing scheme to split the key across multiple custodians, or use a Soroban smart contract with pre-configured alternative signers — but none of this is built into the SDK.

---

## Common Loss Scenarios

Understanding how keys get lost helps you design your app to prevent it.

### 1. App data cleared or uninstalled

**What happens:** User uninstalls the app or clears app data. If the secret key was stored only in local storage (e.g., `AsyncStorage`, `localStorage`) without a backup, it is permanently gone.

**Prevention:** Prompt users to back up their secret key on first wallet creation. Use platform-secure storage (Keychain / Keystore) that survives app updates. Consider a recovery phrase export flow.

### 2. Device lost, stolen, or factory reset

**What happens:** The device is gone and with it any locally stored keys. If no backup exists elsewhere, the funds are unrecoverable.

**Prevention:** Encourage users to write down their secret key or store it in a password manager. For high-value accounts, suggest hardware wallet integration or a cloud-encrypted backup.

### 3. Secret key leaked / compromised

**What happens:** An attacker gains access to the secret key (via phishing, malware, insecure logging, or a data breach). They can drain the account immediately. Changing a password does not help — the key itself is compromised.

**Prevention:** Never log secret keys (see [Logging Guidance](./logging.md)). Use `redactSecretKey()` from the security utilities when displaying keys in debug contexts. Educate users about phishing.

### 4. Server-side key loss

**What happens:** A server storing user keys (e.g., a custodial wallet backend) loses its database — disk failure, accidental deletion, ransomware.

**Prevention:** Encrypt keys at rest. Use automated, tested backups. Consider HSM or vault solutions (e.g., AWS KMS, HashiCorp Vault). Never store keys in plaintext in a database.

### 5. Developer error — key never saved

**What happens:** A developer calls `createWallet()` and forgets to persist the secret key before the process exits or the variable goes out of scope.

**Prevention:** Follow the integration checklist in [Wallet Import Safety](./wallet-import-safety.md). Add a CI check or assertion that verifies wallet creation is always followed by a persistence step.

---

## Who Is Responsible

### Your Responsibility (the App Developer)

As the app developer integrating the PocketPay SDK, you are responsible for:

1. **Key persistence** — Ensuring the secret key is stored securely before the user navigates away from the wallet creation flow.
2. **Backup prompting** — Providing a clear, user-friendly backup flow (e.g., "Write down your secret key" screen, export-to-clipboard with a warning, or encrypted cloud backup).
3. **Secure storage** — Using platform-appropriate secure storage (see [Platform-Specific Guidance](#platform-specific-guidance)).
4. **Education** — Making it clear to users that losing their secret key means losing their funds. Do not overpromise recovery options that do not exist.
5. **Redaction** — Never logging, displaying, or transmitting secret keys in plaintext outside of secure contexts. Use `redactSecretKey()` and `redactSensitiveValue()` from the SDK's security utilities.
6. **Testing** — Verifying that your backup and recovery flows actually work (e.g., simulate a device wipe and confirm the user can restore).

### Your Users' Responsibility

End users are responsible for:

1. **Following backup instructions** — Writing down or securely storing their secret key when prompted.
2. **Not sharing their secret key** — With anyone, including support staff, friends, or "helpers" on social media.
3. **Keeping backups safe** — A recovery phrase written on paper is only useful if the user knows where it is and it hasn't been destroyed.

---

## Platform-Specific Guidance

### Mobile (iOS / Android)

| Concern | Recommendation |
|---|---|
| Storage at rest | Use the OS keychain: iOS Keychain Services or Android Keystore. Libraries like `expo-secure-store` or `react-native-keychain` wrap these APIs. |
| Backup | iOS: Keychain items can sync via iCloud Keychain if configured. Android: Keystore items do **not** survive factory reset — the user must have a separate backup (written key, cloud vault). |
| Biometrics | Gate key access behind biometric auth (Face ID / fingerprint) to reduce risk of device theft. |
| App uninstall | iOS Keychain items may persist across reinstall (depending on keychain access group settings). Android Keystore items are deleted on uninstall. **Do not rely on this** — always prompt a backup. |

See [React Native Compatibility Guide](./react-native.md) for polyfill and storage implementation details.

### Web (Browser)

| Concern | Recommendation |
|---|---|
| Storage at rest | `IndexedDB` or `localStorage` are **not** secure for secret keys. Use the Web Crypto API to generate non-exportable keys where possible, or encrypt the key with a user-supplied passphrase before storing. |
| XSS risk | Any key in JavaScript memory is vulnerable to XSS. Minimize the time the secret key is in memory. Clear it after use. |
| Browser data clearing | Users can clear all site data at any time. Prompt a backup before this happens. |
| Multiple devices | Browser storage does not sync across devices. If the user switches browsers or devices without a backup, the key is lost. |

### Backend / Server-Side

| Concern | Recommendation |
|---|---|
| Storage at rest | Encrypt keys at rest using a managed KMS (AWS KMS, GCP KMS, Azure Key Vault) or a self-hosted vault (HashiCorp Vault). Never store plaintext keys in a database. |
| Access control | Limit which services and personnel can access decrypted keys. Use audit logging. |
| Backups | Automate encrypted backups. Test restores regularly. |
| Rotation | If building a custodial system, consider pre-configuring Stellar multisig so you can rotate signing keys without migrating accounts. |

---

## What to Tell Your Users

If you are building a non-custodial wallet or app, your users need to understand the stakes. Here is suggested language you can adapt:

> **Your secret key is the only way to access your funds.** PocketPay does not store your key and cannot recover it if lost. If you lose your secret key, your funds are permanently inaccessible. Please write it down and store it in a safe place.

Avoid language that implies:

- "We can help you recover your account" (unless you have built a recovery mechanism)
- "Your key is backed up to the cloud" (unless you have implemented and verified this)
- "Contact support if you lose your key" (unless support can actually help)

---

## FAQ

### Q: Can PocketPay recover my secret key?

**A:** No. The PocketPay SDK does not store, transmit, or have access to your secret key. It exists only in your application's memory and whatever storage your app writes it to.

### Q: Can the Stellar network reverse a transaction or freeze an account?

**A:** No. Stellar transactions are final. There is no central authority that can reverse them or recover an account.

### Q: What if I still have my public key but lost the secret key?

**A:** The public key lets you observe the account (balances, transaction history) but you cannot sign any transactions. The funds are permanently locked.

### Q: Is there a way to set up recovery in advance?

**A:** Not through the SDK. Advanced users can pre-configure a Stellar account with multiple signers (multisig) using the raw Stellar SDK, but PocketPay does not expose this functionality. If you need multisig recovery, build it on top of the SDK.

### Q: What about Stellar's "claimable balances" or "account merge"?

**A:** Account merge sends the remaining balance to another account — but it still requires the original secret key to sign. Claimable balances let you lock funds for a specific recipient — but creating one also requires signing with the secret key. Neither helps if the key is already lost.

### Q: Should I store the secret key in `localStorage` / `AsyncStorage`?

**A:** Only for development and testing. For production, use platform-secure storage (Keychain, Keystore, Web Crypto) and prompt the user to back up their key independently. See the platform-specific guidance above.

---

## Related Docs

- [Security Best Practices](./security.md) — Backup responsibility, redaction utilities
- [Wallet Import Safety](./wallet-import-safety.md) — Handling imported keys, integration checklist
- [Getting Started](./getting-started.md) — Wallet creation and import flows
- [React Native Compatibility](./react-native.md) — Mobile secure storage (Keychain / Keystore)
- [Logging Guidance](./logging.md) — What to redact and how
