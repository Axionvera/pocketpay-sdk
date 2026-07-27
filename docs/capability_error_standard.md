# Capability Error Standard Specification

Defines UnsupportedFeatureError and CapabilityMismatchError classes with structured diagnostic context.

## Why this exists

Some SDK surfaces are declared in the public type system but are not usable in
every configuration — vault calls need a deployed contract, and a parameter type
is declared before the underlying Stellar SDK can encode it. Without a standard,
these paths failed with ad-hoc error strings absent from
[`src/errors/codes.ts`](../src/errors/codes.ts). Because `describeError()` falls
back to `"An unexpected error occurred."` for unregistered codes, a missing
capability was indistinguishable from an internal fault.

Both error types extend `PocketPayError`, so existing `catch` blocks and
`instanceof PocketPayError` checks keep working unchanged.

## The two error types

| Type | Meaning | Code used |
| --- | --- | --- |
| `UnsupportedFeatureError` | The operation is declared but not usable in this build of the SDK. | `SDK_NOT_IMPLEMENTED` |
| `CapabilityMismatchError` | The operation exists, but a capability it depends on is not configured. | Injected; must be a published `ErrorCode` |

Neither type replaces or recycles an existing code. `codes.ts` states that
published codes must never be renamed or renumbered, so these classes give their
first call sites to `SDK_NOT_IMPLEMENTED` and `VAULT_CONTRACT_NOT_CONFIGURED`,
which already existed unused. One code is added — `WALLET_TESTNET_ONLY`, for a
network-gated capability that had no registry entry — which `codes.ts` explicitly
allows ("Add new ones; never edit/recycle existing ones").

### Structured context

| Field | Description |
| --- | --- |
| `module` | SDK module the call was routed to, e.g. `vault`. |
| `operation` | Operation attempted, e.g. `deposit`. |
| `capability` | Dot-scoped capability name, e.g. `vault.contract`. |
| `suggestedNextStep` | Taken verbatim from `ERROR_CODES[code].developerHint`, so guidance cannot drift from the registry. |

`toJSON()` returns a log-safe view containing the context and the registry's
`safeMessage` — never the raw `message`, which should still go through
`redactError()` before logging.

## Capability statuses: supported, config-gated, planned, unsupported

`SDK_CAPABILITIES` in [`src/errors/capabilities.ts`](../src/errors/capabilities.ts)
classifies each capability. Absence from the registry means "not classified",
not "supported".

| Status | Meaning | Error raised when unavailable |
| --- | --- | --- |
| `supported` | Implemented and usable with the default configuration. | — |
| `config-gated` | Implemented, but inert until the required configuration is supplied. | `CapabilityMismatchError` |
| `planned` | An extension point exists in the public type surface, but no implementation ships today. | `UnsupportedFeatureError` |
| `unsupported` | Declared in the public type surface and not usable, with no implementation expected from this SDK. | `UnsupportedFeatureError` |

### Supported

| Capability | Module | Notes |
| --- | --- | --- |
| `signer.local` | `account` | `LocalSigner` — signing with a keypair held in local memory. |

### Config-gated

| Capability | Module | Requires |
| --- | --- | --- |
| `vault.contract` | `vault` | `SDKConfig.contractId`, or the `VAULT_CONTRACT_ID` / `STELLAR_CONTRACT_ID` env var |
| `soroban.contract-client` | `soroban` | `ContractClientConfig.contractId` |
| `wallet.testnet-funding` | `wallet` | `SDKConfig.network` set to `"testnet"` (Friendbot is testnet-only) |

### Planned

| Capability | Module | Notes |
| --- | --- | --- |
| `signer.remote` | `account` | The `Signer` interface is deliberately async so remote or hardware signers can replace `LocalSigner`. This SDK ships no remote implementation; consumers may supply their own by implementing `Signer`. |

### Unsupported

| Capability | Module | Notes |
| --- | --- | --- |
| `soroban.param-type.vec` | `soroban` | `ScValType` declares `vec`, but the underlying Stellar SDK rejects it during encoding. |

`planned` describes an extension point that exists today, not a commitment.
Directional plans live in [`roadmap.md`](./roadmap.md), which is explicit that it
carries no delivery dates. Messages in this standard follow the same rule — they
state what is unavailable and what to do about it, and never promise a date or a
release.

## Resolving the vault capability

`resolveContractId()` in [`src/soroban/index.ts`](../src/soroban/index.ts) checks,
in order:

1. the `contractId` call parameter
2. `SDKConfig.contractId` from the config argument
3. the `VAULT_CONTRACT_ID` environment variable
4. the `STELLAR_CONTRACT_ID` environment variable

Step 2 previously did not exist, even though
`ERROR_CODES[VAULT_CONTRACT_NOT_CONFIGURED].developerHint` instructs integrators
to "Set SDKConfig.contractId before vault calls". Following the documented path
therefore failed. Steps 1 and 3 are unchanged, so existing integrations continue
to work.

## Usage

```ts
import {
  isCapabilityMismatchError,
  getCapability,
  depositToVault,
} from 'stellar-pocketpay-sdk';

// Inspect before calling.
const vault = getCapability('vault.contract');
if (vault?.status === 'config-gated') {
  console.log('Vault requires:', vault.requires);
}

try {
  await depositToVault({ sourceSecret, amount: '10' }, { contractId });
} catch (error) {
  if (isCapabilityMismatchError(error)) {
    console.error(error.module, error.operation, error.capability);
    console.error('Next step:', error.suggestedNextStep);
    // describeError(error.code).known === true — no generic fallback.
  }
}
```

## Migration

`MISSING_CONTRACT_ID` was never part of the published registry. Vault calls that
cannot resolve a contract ID now report `VAULT_CONTRACT_NOT_CONFIGURED`, which
`isKnownErrorCode()` recognises and `describeError()` can describe.

Consumers branching on the old string should switch to the published code or to
`isCapabilityMismatchError()`. The thrown value is still a `PocketPayError`, and
its message still contains the phrase "contract ID", so message-based handling —
including `mapSorobanContractError()` — is unaffected.

`TESTNET_ONLY` was likewise unregistered. `fundTestnetAccount` on mainnet now
reports `WALLET_TESTNET_ONLY`, a newly published code. `codes.ts` permits adding
new codes ("Add new ones; never edit/recycle existing ones"); this one describes
a network-gated capability and does not overlap with `SDK_NOT_IMPLEMENTED`. The
message text is unchanged.

## See also

- [Error Standard](./error-standard.md) — the published code registry, categories, and redaction.
- [Configuration](./configuration.md) — how vault configuration is resolved.
- [Soroban Vault](./soroban-vault.md) — vault operations and their error codes.
