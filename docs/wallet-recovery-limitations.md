# Wallet Recovery Limitations

This document explains what PocketPay SDK can and **cannot** do when wallet
secrets are lost, and who is responsible for keeping wallets recoverable.

**The single most important fact:** if a Stellar secret key is lost and no
backup exists, the wallet and all funds it holds are **permanently
unrecoverable**. There is no password reset, no customer support override, and
no hidden recovery mechanism — not in the PocketPay SDK, and not in the Stellar
protocol itself.

## What the SDK Does Not Provide

The PocketPay SDK is a stateless library. It generates and uses keypairs, but
it does **not** offer any of the following:

| Capability | Why it is absent |
|---|---|
| **Password-based recovery** | Stellar accounts are identified by cryptographic keypairs, not email/password pairs. There is no "forgot password" flow that can regenerate a lost secret key. |
| **Key escrow / custodial storage** | The SDK never transmits, stores, or retains a secret key. It has no server-side component that could hold a copy. |
| **Cloud backup or sync** | The SDK does not integrate with iCloud, Google Drive, Google Keychain, or any cloud service. |
| **Social recovery or multi-sig guardians** | The SDK does not implement Shamir secret sharing, social recovery, or guardian-based reconstruction. |
| **Seed phrase generation** | `createWallet` returns a raw Stellar secret key (S...), not a BIP-39 mnemonic. If your app wants a recovery-phrase flow, you must implement it yourself. |
| **Wallet history lookup by owner** | The Stellar ledger is public, but the SDK cannot tell you which secret key controls a given address — only the key holder knows this. |

If your product needs any of these capabilities, your application must
implement them on top of the SDK. The SDK provides only the cryptographic
primitives; everything else is the consuming application's responsibility.

## When Is a Wallet Lost?

A wallet becomes permanently inaccessible when **both** of the following are
true:

1. The secret key (S...) is no longer available to the user or application.
2. No backup of the secret key exists anywhere the user can reach.

Common scenarios that lead to this situation:

### Mobile App

| Scenario | Why it is unrecoverable |
|---|---|
| App uninstalled without exporting the key | The key was stored in the app's sandboxed storage; uninstalling deletes it. |
| Device lost, stolen, or factory-reset without backup | If the key was not backed up to the OS keychain with cloud sync, or exported elsewhere, it is gone. |
| App data cleared by the user or OS | "Clear storage" or aggressive OS cleanup removes the key. |
| Migration to a new device without transfer | If the key was in app-private storage (not the OS keychain with cloud sync), it does not follow the user. |
| Secure storage corruption or OS bug | Rare, but possible. Hardware-backed keystores can lose entries after certain OS updates or security events. |

### Web Application

| Scenario | Why it is unrecoverable |
|---|---|
| Browser storage cleared | IndexedDB, localStorage, and sessionStorage are origin-scoped and can be wiped by the user, browser cleanup, or extension. |
| Incognito / private browsing session closed | Ephemeral sessions do not persist storage across restarts. |
| Different browser or device | Browser storage does not sync across browsers or machines. |
| Storage eviction under pressure | Browsers may evict origin storage when disk is low, especially for rarely-visited sites. |

### Server-Side / Backend

| Scenario | Why it is unrecoverable |
|---|---|
| Secret key committed to source control and then removed | Git history may retain it, but if the repo is force-pushed or the key is rotated, it is gone. |
| Environment variable or secrets manager misconfigured | If the key was only in one environment and that environment is destroyed, it is lost. |
| Database backup does not include the key table | Keys stored in a database require the same backup discipline as the database itself. |

## User Responsibilities

End users of PocketPay-powered applications are responsible for:

- **Backing up their secret key immediately** after wallet creation, using a
  method appropriate to their technical ability (written copy in a secure
  location, encrypted export, hardware wallet, etc.).
- **Verifying their backup works** by importing the key on a different device
  or in a fresh app install before depositing significant funds.
- **Keeping their backup current** if they generate new wallets or rotate keys.
- **Not sharing their secret key** with anyone, including customer support, app
  developers, or "recovery services."
- **Understanding that losing the key means losing access permanently.** There
  is no appeal process.

## App / Developer Responsibilities

The consuming application owns the user experience around key lifecycle. The
SDK provides `createWallet`, `importWallet`, and the signing operations —
everything around them is your responsibility.

### At Wallet Creation

- **Prompt the user to back up the secret key before they can navigate away
  from the creation screen.** Do not let the user proceed until backup is
  confirmed (acknowledged, at minimum).
- **Offer a clear export mechanism** — show the secret key for manual copying,
  or export it to the platform's secure storage.
- **Warn the user about irrecoverability** in plain language, not legal jargon.

### At Wallet Import

- **Validate the key immediately** using `importWallet` and show the derived
  public key so the user can confirm it is the right wallet.
- **Store the imported key in secure storage** before proceeding to any
  balance or transaction operations.
- See [Wallet Import Safety](./wallet-import-safety.md) for detailed guidance.

### During Normal Use

- **Read the key from secure storage only when a signing operation needs it.**
  Do not cache it in application memory or state.
- **Never log, transmit, or display the secret key** in UI, analytics, crash
  reports, or support tools. See [Logging Guidance](./logging.md) and
  [Security Best Practices](./security.md).

### At Logout or Wallet Removal

- **Confirm with the user** that they have backed up the key before deleting it
  from secure storage.
- **Clear all references** to the secret key from application memory, state,
  and any persisted data.

### Platform-Specific Secure Storage

#### iOS

- Use **Keychain Services** with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
  or a similar protection class. Do not use `kSecAttrAccessibleAlways`, which
  allows background access.
- Keychain items marked as synchronizable will sync via iCloud Keychain —
  this is acceptable if the user understands the implications, but do not
  assume it is enabled or available.
- On uninstall, Keychain items **may persist** (behavior varies by iOS version
  and Keychain access group). Your app should handle the case where a key
  exists from a previous install.

#### Android

- Use **Android Keystore** with hardware-backed key storage where available
  (`setIsStrongBoxBacked(true)` on API 28+).
- Keys stored via Keystore are bound to the device and do not survive factory
  reset. Consider offering an encrypted export flow for user-managed backup.
- On uninstall, Keystore entries **are deleted**. The user must re-import
  after reinstall.

#### Web

- **Web Crypto API** (`SubtleCrypto`) provides hardware-backed key storage via
  non-extractable keys, but these are bound to the browser profile and origin.
  They do not survive profile deletion, browser reinstall, or device change.
- **IndexedDB** is the most practical storage for secret keys on the web, but
  it is origin-scoped, evictable, and not encrypted at rest by default.
  Combine with the Web Crypto API to encrypt the key before storing it.
- **localStorage** is synchronous and simpler, but it is accessible to any
  script on the same origin, making it unsuitable for secret keys in
  production. Use it only for prototyping.
- Consider recommending users switch to a mobile app for production use if
  the web experience cannot provide adequate key protection.

## Frequently Asked Questions

### Can the PocketPay SDK recover my wallet if I lost my secret key?

No. The SDK has no knowledge of previously generated keys. It cannot look up,
reconstruct, or guess a secret key from a public key or any other information.

### Can the Stellar network or Horizon recover my wallet?

No. Stellar uses public-key cryptography. The network validates transactions
signed with the secret key — it does not store or know the secret key.

### Can I recover my wallet with just my public key?

No. The public key (G...) is derived from the secret key (S...), but the
reverse is computationally infeasible. The public key lets anyone send funds
*to* the wallet, but only the secret key holder can move funds *out*.

### I still have my public key — can I at least see my balance?

Yes. `getBalance(publicKey)` works with just the public key. You can observe
the wallet on any Stellar block explorer. But you cannot spend the funds
without the secret key.

### Can customer support help me recover my wallet?

No legitimate PocketPay integration will ask for your secret key. If someone
offers "wallet recovery" in exchange for your secret key, it is a scam.

### Is there a way to set up recovery in advance?

Not within the SDK itself. If your application needs recovery, you must
implement it. Common approaches include:

- **Recovery phrase:** Generate a BIP-39 mnemonic from the secret key at
  creation time and require the user to write it down. Your app would derive
  the key from the phrase at recovery time.
- **Encrypted cloud backup:** Encrypt the secret key with a user-held password
  and store the ciphertext in the user's cloud storage (iCloud, Google Drive).
  The password is not recoverable either, so this adds a second thing to
  remember.
- **Social recovery:** Split the secret key into shares (e.g. Shamir's Secret
  Sharing) and distribute them to trusted contacts. This is complex and
  error-prone; test thoroughly.
- **Hardware wallet:** If the user has a Ledger or Trezor, they can store the
  Stellar key on the device. Loss of the hardware wallet requires the
  recovery seed, which is a separate backup concern.

### What if the SDK adds a recovery feature in the future?

Any future recovery feature would be opt-in, require explicit user enrollment,
and be documented separately. It would not retroactively protect wallets
created with the current SDK version. Plan for the current behavior: no
recovery.

## Related Documentation

- [Security Best Practices](./security.md) — Key management and transaction safety
- [Wallet Import Safety](./wallet-import-safety.md) — Safe handling of imported secret keys
- [Getting Started](./getting-started.md) — Wallet creation and initial setup
- [React Native Compatibility](./react-native.md) — Secure storage guidance for mobile apps
- [Logging Guidance](./logging.md) — Avoid leaking secret keys in logs
