# Vault capabilities and action intents

The vault module models six actions. **Three work today and three do not**, and
this document exists so that an application never has to read the SDK source to
find out which is which.

```ts
import { describeVaultReadiness, executeVaultIntent } from 'stellar-pocketpay-sdk';

// Ask before rendering a control, rather than rendering it and failing later.
const readiness = describeVaultReadiness();

const result = await executeVaultIntent({
  kind: 'deposit',
  sourceSecret,
  amount: '10',
  contractId,
});
```

## Readiness

| Action | Supported | Capability | Feature flag |
|---|---|---|---|
| `deposit` | yes | `vault.contract` | — |
| `withdraw` | yes | `vault.contract` | — |
| `getBalance` | yes | `vault.contract` | — |
| `createLock` | **no** | `vault.lock` | `experimentalVaultLocks` |
| `listLocks` | **no** | `vault.lock` | `experimentalVaultLocks` |
| `withdrawMaturedLock` | **no** | `vault.lock` | `experimentalVaultLocks` |

The deployed savings-vault contract exposes `deposit`, `withdraw` and
`get_balance`. There is no contract entry point for time-locked positions, so no
SDK path can perform one. The lock actions are **represented** — you can build,
type-check and inspect a `createLock` intent — but executing one returns a typed
error rather than a missing function or a silent no-op.

## Which error means what

Three gates run in order, from most actionable to least:

| Situation | Error | Can the caller fix it? |
|---|---|---|
| No `contractId` | `CapabilityMismatchError` on `vault.contract`, code `VAULT_CONTRACT_NOT_CONFIGURED` | **Yes** — configure the contract |
| Lock action, flag off | `DisabledFeatureError` on `experimentalVaultLocks` | **Yes** — enable the flag, though see below |
| Lock action, flag on | `UnsupportedFeatureError` on `vault.lock` | **No** |

The ordering is deliberate: a missing `contractId` is reported first even for a
lock action, because it is the failure the caller can actually resolve.

### Enabling the flag does not make locks work

This is the distinction the module exists to preserve. `experimentalVaultLocks`
controls whether the SDK will *attempt* a lock action. Turning it on changes
`DisabledFeatureError` into `UnsupportedFeatureError` — it does not create a
contract entry point. A disabled flag and a missing capability are different
problems with different fixes, and collapsing them into one error is what leads
a UI to show a retry button for something that can never succeed.

`SDK_CAPABILITIES['vault.lock']` carries status `planned`, and `assertCapability`
routes `planned` and `unsupported` capabilities to `UnsupportedFeatureError`
automatically. The status lives in the published registry, not in this module.

## Feature flag resolution

`experimentalVaultLocks` is not listed in `DEFAULT_FEATURE_FLAGS`. It does not
need to be: an unregistered flag resolves to `false`, so the safe default holds.
Enable it explicitly or through the environment:

```ts
executeVaultIntent(intent, { featureFlags: { experimentalVaultLocks: true } });
```

```bash
POCKETPAY_FEATURE_FLAGS=experimentalVaultLocks
```

## Limitations

- **Locks are not implemented.** This document and the typed errors make the gap
  legible; they do not close it. No date is implied.
- **Readiness is static.** It reflects what the SDK can call, not what a
  particular deployed contract supports. A contract missing `deposit` would
  still surface as a contract-level failure at execution time.
- **Intents carry secrets.** `sourceSecret` appears in deposit, withdraw,
  `createLock` and `withdrawMaturedLock` intents. Nothing in this module copies
  an intent into an error or a result, and a test asserts the secret never
  reaches a thrown error — but treat an intent object with the same care as the
  key itself.
- **Validation is delegated.** Amount and key checks reuse the SDK's existing
  validators rather than adding a parallel set.

## API

| Export | Purpose |
|---|---|
| `executeVaultIntent(intent, config?)` | Run an action, or explain in a typed error why not |
| `validateVaultIntent(intent)` | Local input validation, no network |
| `describeVaultReadiness()` | Readiness for all six actions |
| `isVaultActionSupported(kind)` | Single-action check |
| `listSupportedVaultActions()` | The three that work today |
| `VAULT_ACTION_READINESS` | The readiness table itself |
| `VAULT_LOCKS_FEATURE_FLAG` | The flag key, so callers need not hardcode it |
| `VaultActionKind`, `VaultActionIntent`, `VaultActionReadiness` | Types |
