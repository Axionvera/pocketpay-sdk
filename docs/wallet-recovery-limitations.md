# Wallet Recovery Limitations

This document explains what the PocketPay SDK can and cannot do when a user loses access to their wallet. Read this before building user-facing flows around wallet creation and import.

> [!CAUTION]
> **The SDK provides no recovery mechanism.** If a secret key is lost and was never backed up, the wallet and all funds it controls are **permanently unrecoverable**. There is no password reset, no seed-phrase reconstruction, and no custodial fallback built into the SDK.

---

## Table of Contents

- [How PocketPay Wallets Work](#how-pocketpay-wallets-work)
- [What "Lost" Means](#what-lost-means)
- [What the SDK Does NOT Provide](#what-the-sdk-does-not-provide)
- [What Your Application Must Provide](#what-your-application-must-provide)
- [Platform-Specific Guidance](#platform-specific-guidance)
  - [Mobile (React Native / Expo)](#mobile-react-native--expo)
  - [Web Applications](#web-applications)
  - [Server-Side / Backend](#server-side--backend)
- [Common Loss Scenarios](#common-loss-scenarios)
- [FAQ](#faq)
- [Related Docs](#related-docs)

---

## How PocketPay Wallets Work

A PocketPay wallet is a Stellar keypair:

- **Public key** (starts with `G`) — the wallet address. Safe to share. Used to receive funds and query balances.
- **Secret key** (starts with `S`) — authorizes transactions. **Whoever holds the secret key controls the wallet.**

The SDK's `createWallet()` generates a random keypair **in memory only**. It returns the keys to the caller and stores nothing. The SDK has no database, no keyring, no cloud sync, and no built-in concept of a user account.

```typescript
const wallet = createWallet();
// wallet.publicKey  — shareable address
// wallet.secretKey  — YOU must persist this. The SDK will not.
```

`importWallet(secretKey)` reconstructs a wallet from a secret key the caller supplies. It does not fetch anything from storage — your app must retrieve the secret key from wherever it was saved.

---

## What "Lost" Means

A wallet is **lost** when the secret key is no longer accessible to the user or the application. This includes:

- The secret key was never saved after `createWallet()`.
- The secret key was stored in volatile storage (memory, session storage) and the app/process restarted.
- The device holding the secret key was wiped, stolen, or bricked.
- The backup location (file, vault, cloud) was deleted, corrupted, or access was revoked.
- The secret key was encrypted with a passphrase the user forgot.

In all of these cases, **the funds in that wallet cannot be recovered by any means**. This is a fundamental property of Stellar's cryptographic design, not a limitation that a future SDK version will fix.

---

## What the SDK Does NOT Provide

The PocketPay SDK is a **non-custodial** toolkit. It intentionally does not include:

| Feature | Why it's absent |
|---|---|
| **Seed phrase / mnemonic generation** | The SDK uses raw Stellar keypairs. If you want BIP-39 mnemonics, generate them in your app layer and derive the keypair yourself. |
| **Key escrow / custodial backup** | Storing user keys on your behalf would make you a custodian with regulatory and security implications. The SDK stays non-custodial. |
| **Password-based key recovery** | There is no "forgot password" flow. A Stellar secret key is a 56-character random string — it cannot be derived from a user-chosen password. |
| **Multi-device sync** | The SDK has no cloud or sync service. If your app needs multi-device access, implement your own secure sync layer. |
| **Social recovery / guardians** | The SDK does not implement Shamir's Secret Sharing or social recovery schemes. These can be built on top, but are outside the SDK's scope. |
| **Account freeze / clawback** | Stellar's `CLAWBACK_ENABLED` flag must be set at account creation time and requires the issuing account's cooperation. The SDK does not configure or manage this. |

If your application needs any of these features, you must build or integrate them separately.

---

## What Your Application Must Provide

Since the SDK does not persist keys, **your application is responsible for the entire key lifecycle**:

### 1. Immediate backup after creation

```typescript
const wallet = createWallet();

// ❌ WRONG — doing nothing, hoping the user remembers
session.set('wallet', wallet); // volatile, lost on restart

// ✅ RIGHT — prompt user to back up before proceeding
await promptUserToSaveSecretKey(wallet.secretKey);
await saveToSecureStorage(wallet.publicKey, wallet.secretKey);
```

### 2. Secure storage

Use platform-appropriate secure storage:

- **Mobile:** OS keychain (iOS Keychain, Android Keystore) via `expo-secure-store` or `react-native-keychain`.
- **Web:** Encrypted `IndexedDB` or a backend vault. **Never** use `localStorage` for secret keys.
- **Server:** Hardware security module (HSM), encrypted environment variables, or a secrets manager (AWS Secrets Manager, HashiCorp Vault).

### 3. User-facing recovery guidance

Your app's UI should clearly communicate:

- That losing the secret key means losing funds permanently.
- How and where the secret key was backed up.
- What the user should do if they think their key is compromised (create a new wallet and transfer funds immediately).

### 4. Compromise response

If a secret key may have been exposed, the only mitigation is to **transfer all funds to a new wallet** whose secret key has not been compromised. The SDK provides no "rotate key" or "freeze account" primitive.

---

## Platform-Specific Guidance

### Mobile (React Native / Expo)

Mobile apps face unique risks: device loss, factory reset, app uninstall, and OS-level data wiping.

**Do:**
- Store secret keys in the OS keychain (`expo-secure-store` or `react-native-keychain`). Keychain data survives app uninstall on iOS and most Android devices.
- Prompt the user to write down or export their secret key during onboarding, **before** they deposit funds.
- Consider offering a cloud-backup option (e.g., encrypted iCloud/Google Drive backup) **with clear disclosure** that the backup exists and what protects it.

**Don't:**
- Store secret keys in `AsyncStorage` or `MMKV` — these are not encrypted at rest and are cleared on app uninstall.
- Assume the user has a device backup. Many users disable automatic backups.
- Rely on biometric auth alone as "recovery" — biometrics unlock the keychain entry, but if the keychain entry is gone, biometrics cannot reconstruct it.

**When the device is lost:**
If the secret key was only in the keychain and the user has no backup, the wallet is unrecoverable. Your onboarding flow should make this clear before the user funds the wallet.

### Web Applications

Web apps face risks from browser data clearing, cache eviction, and cross-device access needs.

**Do:**
- Store secret keys on your **backend** (encrypted at rest) after authenticating the user. This gives you multi-device access and recovery options controlled by your auth system.
- If storing client-side, use `IndexedDB` with encryption and tie decryption to a user passphrase.
- Implement a clear "export secret key" flow in settings.

**Don't:**
- Store secret keys in `localStorage` or `sessionStorage` — these are trivially accessible to any JS on the page and are cleared when the user clears browser data.
- Store secret keys in cookies.
- Assume the user's browser will retain data indefinitely — browsers can evict storage under storage pressure.

**When browser data is cleared:**
If the secret key was only in client-side storage and the user clears their browser data (or switches browsers/devices), the wallet is unrecoverable unless you have a backend copy.

### Server-Side / Backend

Server-side applications manage wallets programmatically, often for treasury, hot-wallet, or automated-payment use cases.

**Do:**
- Use a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager).
- Encrypt secret keys at rest with a key derived from a master secret that is itself stored in an HSM or KMS.
- Implement access controls — not every service or developer should have access to production secret keys.
- Maintain offline backups of critical wallet keys (e.g., cold-storage backups on encrypted, air-gapped media).

**Don't:**
- Store secret keys in environment variables in production (acceptable for dev/test only).
- Commit secret keys to source control or CI/CD configs.
- Log secret keys (see [Logging Guidance](./logging.md)).

**When the server is compromised:**
Rotate immediately: create a new wallet, transfer all funds, and decommission the old key. Your incident-response plan should include this scenario.

---

## Common Loss Scenarios

| Scenario | Can the wallet be recovered? | Prevention |
|---|---|---|
| User uninstalls app (secret key in volatile storage only) | **No** | Store in OS keychain; prompt backup during onboarding |
| User factory-resets device (no cloud backup) | **No** | Encourage cloud backup or written recovery phrase |
| Browser data cleared (secret key in `localStorage`) | **No** | Use backend storage or encrypted `IndexedDB` |
| Server disk failure (no backup) | **No** | Encrypted offline backups; secrets manager with replication |
| Secret key leaked / compromised | **No** — but funds can be saved | Transfer funds to a new wallet immediately |
| Encryption passphrase forgotten | **No** | Use a passphrase manager; offer key export without re-encryption |
| App developer shuts down service (custodial model) | **No** (if no export offered) | Always offer a non-custodial export path to users |

---

## FAQ

**Q: Can the PocketPay team recover my wallet if I lose my secret key?**
A: No. The PocketPay team has no access to your secret key. The SDK is non-custodial by design.

**Q: Can I use a seed phrase (12/24 words) instead of a raw secret key?**
A: The SDK does not generate or manage seed phrases. You can implement BIP-39 mnemonic generation in your application layer and derive the Stellar keypair from it, but this is your responsibility.

**Q: What happens if I call `createWallet()` twice without saving the first key?**
A: The first wallet's keypair is lost. A new, unrelated keypair is generated. The two wallets share nothing — they have different addresses and different secret keys.

**Q: Can I change or rotate a wallet's secret key?**
A: Stellar does not support key rotation on existing accounts. The only way to "rotate" is to create a new wallet and transfer all assets from the old one.

**Q: Does the SDK store anything on disk or send data to any server?**
A: No. All SDK functions are stateless — they generate keys, sign transactions, and query Horizon in memory. Nothing is written to disk and no analytics or telemetry are sent anywhere.

**Q: If someone guesses my public key, can they access my funds?**
A: No. The public key is safe to share. Only the corresponding secret key can authorize transactions.

---

## Related Docs

- [Wallet Import Safety](./wallet-import-safety.md) — Safe handling of externally sourced secret keys
- [Security Best Practices](./security.md) — Backup responsibility and redaction utilities
- [Getting Started](./getting-started.md) — Wallet creation and initial funding flow
- [React Native Compatibility](./react-native.md) — Secure storage options for mobile apps
- [Logging Guidance](./logging.md) — What to redact from logs
