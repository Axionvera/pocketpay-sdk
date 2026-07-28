# Runtime Compatibility

This guide describes SDK support across Node.js, Expo React Native, and browser
environments. All compatibility claims are conservative and based on the current
implementation.

The SDK is **primarily developed and tested against Node.js ≥ 18 on Testnet**.
Expo and browser support is **untested** unless explicitly noted. Do not treat
untested environments as production-ready without your own validation.

---

## Compatibility Matrix

| Feature / Module | Node.js (≥ 18) | Expo React Native | Browser | Notes |
|---|---|---|---|---|
| **Wallet** (`createWallet`) | ✅ Supported | ⚠ Untested | ⚠ Untested | Depends on `crypto` (SubtleCrypto / Ed25519). Native Node.js crypto in Node ≥ 18; requires polyfill elsewhere. |
| **Payments** (`sendXLM`) | ✅ Supported | ⚠ Untested | ⚠ Untested | Requires `fetch` and Horizon access. Node ≥ 18 has native `fetch`; older runtimes need a polyfill. |
| **Transactions** (`getTransactions`, `getPayments`) | ✅ Supported | ⚠ Untested | ⚠ Untested | Requires `fetch` and Horizon access. Pagination is cursor-based; no DOM dependency. |
| **Soroban vault** (`depositToVault`, `withdrawFromVault`, `getVaultBalance`) | ✅ Supported | ⚠ Untested | ⚠ Untested | Pre-release. Requires a deployed savings-vault contract (`VAULT_CONTRACT_ID`) and Soroban RPC access. |
| **Configuration** (`dotenv` / env vars) | ✅ Supported | ❌ Not applicable | ❌ Not applicable | `dotenv` is a server-side utility. In Expo or browser, supply values directly rather than via `.env` files. |
| **Examples** (docs & quick-start) | ✅ Node.js only | ⚠ Adaptation required | ⚠ Adaptation required | Examples assume a Node.js environment. Env-var loading and network access must be adapted for other runtimes. |

### Key

| Symbol | Meaning |
|---|---|
| ✅ Supported | Tested and expected to work. |
| ⚠ Untested | May work; no test coverage in this SDK. Validate before use. |
| ❌ Not supported / Not applicable | Will not work or does not apply to this environment. |

---

## Runtime Notes

### Network Requirements

All SDK operations that communicate with the Stellar network require outbound
HTTPS access:

- **Horizon API** (`https://horizon-testnet.stellar.org` on Testnet) — used by
  wallet funding (Friendbot), payments, and transaction/payment history.
- **Soroban RPC** — required by the vault helpers. The endpoint must be
  supplied by the caller. On Testnet the public endpoint is
  `https://soroban-testnet.stellar.org`.

If either endpoint is unreachable the SDK will throw a network error. See
[Network Error Handling](./network-errors.md) for retry guidance.

---

### Environment Variables

The SDK reads configuration at runtime via `process.env` (loaded by `dotenv`
in Node.js). The following variables are relevant:

| Variable | Purpose |
|---|---|
| `STELLAR_NETWORK` | `testnet` or `mainnet` (SDK is Testnet-focused; Mainnet is unsupported). |
| `HORIZON_URL` | Override the default Horizon endpoint. |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint for vault helpers. |
| `VAULT_CONTRACT_ID` | Deployed savings-vault contract ID (required for Soroban helpers). |

`dotenv` is a **Node.js-only** mechanism. In Expo or browser builds, inject
these values through your platform's configuration mechanism (e.g.
`expo-constants`, a bundler `define` plugin, or a runtime config object) and
pass them explicitly to the SDK. Do **not** ship secret keys in a browser
bundle.

---

### Required Polyfills

The following runtime primitives are used by the SDK and its dependencies
(`@stellar/stellar-sdk`). They are available natively in Node.js ≥ 18; other
environments may require polyfills.

#### `Buffer`

`Buffer` is a Node.js global. In browser or React Native environments,
install and configure [`buffer`](https://www.npmjs.com/package/buffer):

```js
// In your entry file (e.g. index.js for React Native / Expo)
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
```

#### `crypto`

The wallet module uses the `@stellar/stellar-sdk` key-generation utilities,
which rely on the Web Crypto API (`SubtleCrypto`). This is available natively
in:

- Node.js ≥ 18 (`globalThis.crypto`)
- Modern browsers (all current releases)
- Expo / React Native — available from **React Native 0.71+** and
  **Expo SDK 48+** via `expo-crypto` or the built-in Hermes crypto. Older
  versions may require a polyfill.

#### `fetch`

All network calls use the global `fetch`. Available natively in:

- Node.js ≥ 18
- Modern browsers

In older Node.js versions or React Native, install and configure
[`cross-fetch`](https://www.npmjs.com/package/cross-fetch) or
[`node-fetch`](https://www.npmjs.com/package/node-fetch) and assign to
`globalThis.fetch` before calling any SDK function.

#### `TextEncoder` / `TextDecoder`

Used by `@stellar/stellar-sdk` internally for encoding/decoding operations.
Available natively in Node.js ≥ 11, all modern browsers, and React Native /
Expo (Hermes). If your environment lacks these, add the
[`text-encoding`](https://www.npmjs.com/package/text-encoding) polyfill.

---

### React Native / Expo Polyfill Summary

If you are targeting Expo or bare React Native, a typical entry-file setup
may look like:

```js
// index.js — before any SDK import
import 'react-native-get-random-values'; // crypto.getRandomValues
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// If fetch is not available in your RN version:
// import 'cross-fetch/polyfill';
```

> **Important:** The SDK has not been tested in any React Native or Expo
> environment. The polyfill suggestions above are provided as guidance only.
> You are responsible for validating SDK behaviour in your specific
> environment and React Native / Expo version.

---

## Supported Node.js Versions

The SDK declares `"engines": { "node": ">=18.0.0" }`. Node.js 18+ is required
because:

- Native `fetch` is available from Node.js 18.
- Native `crypto` (`globalThis.crypto`) is available from Node.js 18.
- The current CI and test suite run against Node.js 18+.

Earlier Node.js versions are **not supported**.

---

## Related Docs

- [Getting Started](./getting-started.md)
- [Network Error Handling](./network-errors.md)
- [Security Best Practices](./security.md)
