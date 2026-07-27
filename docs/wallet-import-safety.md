# Wallet Import Safety

Importing a Stellar secret key gives an application full control of the
associated wallet and funds. Treat an imported key as highly sensitive from
the moment the user enters it until it is removed from memory or secure
storage.

The PocketPay SDK can use a key supplied by a consuming application, but the
consuming application is responsible for how that key is collected, stored,
and passed to the SDK. The SDK does not make insecure application storage safe.

## Non-Negotiable Rules

- **Never log a secret key.** Do not include it in console output, structured
  logs, error messages, stack-trace context, or debugging snapshots.
- **Never send a secret key to an external server.** This includes an app's own
  backend, analytics tools, crash reporters, monitoring services, support
  tools, and third-party APIs.
- Keep signing local to the user's device. Pass the key only to the PocketPay
  SDK operation that requires it, and do not include it in network request
  payloads.
- Do not store secret keys in plain-text preferences, unencrypted databases,
  files, browser storage, source code, or environment/configuration files
  bundled with the mobile app.

## Consuming App Storage Responsibility

If a PocketPay mobile app accepts imported keys, the app must protect them
using secure local storage appropriate to its platform, such as an operating
system keychain, keystore, or equivalent hardware-backed secure storage where
available. Access should be limited to the app, and device authentication
should be required when appropriate for the product's threat model.

The app is also responsible for:

- ensuring backups and device migrations do not expose the key;
- clearing the key when the wallet is removed or the user signs out;
- preventing the key from appearing in screenshots, clipboard history, UI
  state persistence, diagnostic reports, or analytics events;
- reviewing dependencies and error-handling paths for accidental disclosure;
- documenting whether and how an imported wallet can be recovered.

## Safe Handling Patterns

- Collect the key in a dedicated, masked input that disables autocorrect and
  avoids persisting form state.
- Validate the key locally, store it immediately in platform secure storage,
  and clear the input state as soon as practical.
- Read the key only when a local signing operation needs it, pass it directly
  to the relevant PocketPay SDK call, and release references afterward.
- Log only non-secret values such as the wallet's public key, transaction hash,
  or a sanitized error code.
- Redact fields named `secretKey`, `seed`, or similar at the logging and crash
  reporting boundaries as defense in depth.

```typescript
// The secure storage implementation is owned by the mobile app.
const secretKey = await secureStorage.get('wallet-secret-key');

try {
  await pocketPay.sendPayment({ secretKey, destination, amount });
  logger.info('Payment submitted', { publicKey, destination });
} finally {
  // Do not retain the key in component, navigation, or persisted app state.
}
```

JavaScript strings cannot be reliably zeroed from memory, so minimize how long
the key is referenced and never rely on manual clearing as a substitute for
secure storage and careful data flow.

## Unsafe Handling Patterns

```typescript
// Unsafe: secrets can reach device logs and log aggregation services.
console.log('Imported wallet', { secretKey });

// Unsafe: imported keys must not leave the device.
await api.post('/wallets/import', { secretKey });
analytics.track('wallet_imported', { secretKey });
crashReporter.setAttribute('secretKey', secretKey);

// Unsafe: ordinary app storage is not suitable for wallet secrets.
await preferences.set('wallet-secret-key', secretKey);
```

Do not send a secret key to customer support or ask a user to paste one into a
support ticket. Diagnose wallet-import problems with public keys, sanitized
error codes, and non-sensitive device or transaction metadata.

## Validation & Safe Error Handling

When importing secret keys, the SDK performs strict local validation prior to any key derivation or SDK operations:

- **Type Check**: Non-string values throw `PocketPayError` with validation reason `not_a_string`.
- **Presence Check**: Empty or whitespace-only strings throw `PocketPayError` with validation reason `missing`.
- **Prefix Check**: Keys must start with `'S'`. Non-matching values throw `PocketPayError` with validation reason `invalid_prefix`.
- **Length Check**: Keys must be exactly 56 characters. Incorrect lengths throw `PocketPayError` with validation reason `invalid_length`.
- **Format Check**: Keys with invalid strkey payloads or checksums throw `PocketPayError` with validation reason `invalid_format`.

### Redaction Guarantee
Secret key inputs are **never** attached to `error.validation.value` or raw error messages. Sanitized error messages give clear guidance without echoing key material.

### Safe & Enhanced Import Helpers

In addition to `importWallet(secretKey)`, the SDK provides non-throwing and enriched wrappers:

```typescript
import { safeImportWallet, enhancedImportWallet } from '@axionvera/pocketpay-sdk';

// 1. Non-throwing result wrapper
const result = safeImportWallet(userInputKey);
if (result.ok) {
  console.log('Wallet imported:', result.value.publicKey);
} else {
  console.error('Import failed [code]:', result.error.code);
}

// 2. Enhanced wrapper with recovery hints
const enhanced = enhancedImportWallet(userInputKey);
if (!enhanced.ok) {
  enhanced.recoveryHints?.forEach(hint => {
    console.log('Recovery action:', hint.action, hint.message);
  });
}
```

## Integration Checklist

- Secret keys never appear in logs, errors, analytics, or crash reports.
- Secret keys never leave the user's device.
- Imported keys are stored only in platform secure storage.
- Signing occurs locally through the PocketPay SDK.
- UI, clipboard, backup, logout, and wallet-removal flows are reviewed for
  secret retention.
- Tests and debugging tools use dedicated test accounts, never user keys.
