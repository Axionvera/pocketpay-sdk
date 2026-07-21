# Security Best Practices

Security guidance for applications using the PocketPay SDK.

## Key Management

- Never hardcode secret keys in source code
- Use environment variables or secure key stores
- Rotate keys periodically
- Use separate keys for development and production

## Wallet Backup Responsibility

`createWallet` generates a keypair and returns it — the SDK does not persist,
store, sync, or back up `secretKey` in any way. Once the returned value is
lost (process exit, dropped reference, uninstalled app, etc.), the wallet and
any funds it holds are permanently unrecoverable. There is no
password-reset equivalent for a Stellar secret key.

The consuming application (or the end user) owns backup and long-term
storage. Typical approaches:

- Persist `secretKey` to encrypted device storage, an OS keychain, or an HSM
  immediately after `createWallet` returns.
- Walk the user through a recovery-phrase or secret-key export flow before
  they can navigate away from the creation screen.
- For server-side scripts or test fixtures, load `secretKey` from environment
  variables or a secrets manager — never commit it to source control.

The same applies to wallets restored later via `importWallet`: the SDK has
no memory of previously created wallets, so the secret key must come from
wherever your app backed it up.

## Logging

See [Logging Guidance](./logging.md) for safe logging practices.

## Redaction Utilities

The SDK provides `redactSecretKey` and `redactSensitiveValue` utilities to
safely mask sensitive values in logs, debug output, and error messages.

### redactSecretKey

Mask a Stellar secret key, keeping only the first 4 and last 4 characters:

```ts
import { redactSecretKey } from 'stellar-pocketpay-sdk';

const key = 'SC4M4LZP...FULL_KEY...QUCK4L';
console.log('Signing with:', redactSecretKey(key));
// => "Signing with: SC4M...CK4L"
```

- Never validates or exposes the full key.
- Returns `"(empty)"` for empty/blank input.
- Already-redacted values (containing `...`) are returned as-is (idempotent).

### redactSensitiveValue

General-purpose redaction for any sensitive string:

```ts
import { redactSensitiveValue } from 'stellar-pocketpay-sdk';

console.log('API key:', redactSensitiveValue('sk_live_abc123xyz789'));
// => "API key: sk_l...z789"
```

Both utilities are designed to **never throw** on invalid or unexpected input,
so they are safe to use in error-reporting paths.

## Transaction Safety

- Always verify transaction envelopes before signing
- Check destination addresses match expected values
- Set appropriate time bounds on transactions

## Error Handling

- Do not expose internal error details to end users
- Log errors safely following the logging guidance
- Validate all user inputs before constructing transactions
