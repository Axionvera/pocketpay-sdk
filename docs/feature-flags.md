# Feature Flags and Feature Stability Policy

This SDK uses a **Feature Flag Framework** to gate experimental, in-flight, or opt-in capabilities. Experimental features allow developers to test emerging functionality before it is promoted to general availability, while ensuring that incomplete features are **disabled by default** to prevent accidental production impact.

---

## Stability Lifecycles

1. **Experimental (`experimental*`)**
   - Disabled by default.
   - Requires explicit enablement via `SDKConfig.featureFlags` or environment variables.
   - If invoked while disabled, the SDK throws a typed `DisabledFeatureError` with code `SDK_FEATURE_DISABLED`.
   - APIs may evolve across minor versions with notice.
2. **Stable (Supported)**
   - Enabled and supported by default with standard configuration.
   - Subject to strict backwards compatibility semantics.

---

## Registered Experimental Feature Flags

Every registered flag defaults to `false`. A flag that gates a code path is
listed as **Active**; one kept for a planned capability that no code consults
yet is listed as **Reserved**, so the table never implies a capability the SDK
does not have.

| Feature Flag Key | Module | Status | Purpose |
|---|---|---|---|
| `experimentalVault` | `vault` | Active | Batch operations and experimental Soroban savings vault helpers (`executeExperimentalVaultBatch`). |
| `experimentalSorobanEvents` | `soroban` | Active | Soroban contract event polling (`querySorobanEvents`). |
| `experimentalVaultLocks` | `vault` | Active | Vault lock intents — lock creation, lock listing and matured-lock withdrawal. Enabling it does **not** make them work: the capability is registered as `planned` and the actions return `UnsupportedFeatureError`. See [Vault capabilities](./vault-capabilities.md). |
| `experimentalMultiAssetVault` | `vault` | **Reserved** | Multi-asset vault deposit/withdraw support. No code path consults this flag today. |
| `experimentalAsyncSigner` | `account` | **Reserved** | Remote / async signer interface. No code path consults this flag today. |

### Registry completeness

A flag that gates code but is missing from `DEFAULT_FEATURE_FLAGS` still
resolves to `false`, so nothing breaks — but no consumer can discover it and
`config.resolved` diagnostics will not report its state. That drift is silent by
construction, and it happened: `experimentalVaultLocks` is passed as a variable
rather than a literal, so it never appeared in a search of call sites.

`tests/feature-flag-registry.test.ts` now scans `src/` for `experimental*` flag
keys and fails when one is unregistered or undocumented. Adding a flag without
registering it is a test failure rather than a silent omission.

---

## Configuration Mechanisms

Feature flags follow the standard SDK configuration precedence order:
**Explicit `SDKConfig` param override > Environment variable > SDK Default (`false`)**

### 1. Programmatic Configuration (`SDKConfig.featureFlags`)

```typescript
import { resolveConfig, executeExperimentalVaultBatch } from 'stellar-pocketpay-sdk';

const config = resolveConfig({
  network: 'testnet',
  featureFlags: {
    experimentalVault: true,
  },
});

// Access experimental capability safely
const batchResults = await executeExperimentalVaultBatch(operations, config);
```

### 2. Environment Variables

You can enable feature flags globally via environment variables:

```bash
# Enable individual feature flags using POCKETPAY_FEATURE_<FLAG_NAME> or STELLAR_FEATURE_<FLAG_NAME>
POCKETPAY_FEATURE_EXPERIMENTAL_VAULT=true
STELLAR_FEATURE_EXPERIMENTAL_SOROBAN_EVENTS=true

# Or enable multiple flags using a comma-separated list
POCKETPAY_FEATURE_FLAGS=experimentalVault,experimentalSorobanEvents
```

---

## Querying and Asserting Feature Flags

The SDK provides helper functions to check or enforce feature flag states:

```typescript
import { isFeatureEnabled, assertFeatureEnabled } from 'stellar-pocketpay-sdk';

// Non-throwing check
if (isFeatureEnabled('experimentalVault', config)) {
  // Safe to proceed with experimental path
}

// Guard assertion (throws DisabledFeatureError if disabled)
assertFeatureEnabled('experimentalVault', {
  module: 'vault',
  operation: 'executeExperimentalVaultBatch',
}, config);
```

---

## Disabled Feature Error Handling

When an operation requires a feature flag that is disabled, the SDK throws `DisabledFeatureError` (code: `SDK_FEATURE_DISABLED`).

```typescript
import { isDisabledFeatureError, ErrorCode } from 'stellar-pocketpay-sdk';

try {
  await executeExperimentalVaultBatch(operations);
} catch (error) {
  if (isDisabledFeatureError(error)) {
    console.error(`Feature '${error.featureFlag}' is disabled for ${error.module}.${error.operation}.`);
    console.log(`Developer hint: ${error.suggestedNextStep}`);
  }
}
```

---

## Safe Diagnostics Integration

Feature flag states and non-sensitive configuration origin metadata (`sources`: `override`, `env`, or `default`) are included in diagnostics events (`config.resolved`) and support reports built via `buildDiagnosticsReport()`. Secret values (e.g. secret keys `S...`) are never exposed.
