# ADR 0002: Account Abstraction Layer

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** PocketPay SDK maintainers
- **Issue:** [#159 — Design SDK account abstraction layer for wallet and signer flows](https://github.com/Axionvera/pocketpay-sdk/issues/159)
- **Type:** Feature / Architecture

## Context

The SDK's original model for "an account" was a `WalletKeypair` — a plain
object holding both `publicKey` and `secretKey`. This worked for the initial
scope (creating and using a single local wallet), but it created two friction
points:

1. **Identity and secrets were coupled.** Code that only needed a public key
   (balance queries, history lookups, address display) still had to handle an
   object that carried secret material, increasing the risk of accidental
   logging or exposure.

2. **No extension point for non-local signers.** The Stellar ecosystem supports
   multisig accounts, hardware wallet signing, remote HSMs, and MPC-based
   signers. None of these fit the `WalletKeypair` model; adding them later
   would require breaking changes to function signatures across the codebase.

The payments module (`sendXLM`) and the Soroban vault module
(`depositToVault`, `withdrawFromVault`) both accept a raw `sourceSecret` string
and derive the keypair internally. This couples signing and identity tightly
at the call site and repeats the derivation in every module.

## Decision

We introduce a lightweight account abstraction layer at `src/account/`. The
layer is additive — it does not replace existing wallet helpers — and is
structured around three concepts:

### AccountIdentity

A `readonly publicKey: string` object. No secret material. Safe to log, pass
across layers, and use with read-only SDK operations.

### Signer

A two-member interface:

```ts
interface Signer {
  readonly publicKey: string;
  sign(tx, networkPassphrase): Promise<Transaction | FeeBumpTransaction>;
}
```

`sign()` is async so local (synchronous) and remote (asynchronous) signers are
interchangeable at the call site.

`LocalSigner` is the built-in implementation, wrapping a Stellar `Keypair`.
It validates the secret key on construction and exposes the derived public key.

### AccountAbstraction

Binds an `AccountIdentity` to an optional `Signer`:

- **Read-only** (`createReadOnlyAccount`): identity only; `canSign` is `false`;
  `sign()` throws. For balance queries, history, and watch-only display.
- **Local-wallet** (`createLocalAccount`): identity + `LocalSigner`; `canSign`
  is `true`. Replaces the pattern of holding a raw `WalletKeypair` when you
  need to sign.
- **Custom signer** (`createAccountWithSigner`): identity + any `Signer`
  implementation. The extension point for hardware wallets, remote HSMs, and
  future signer types.

### Module placement

```
src/account/
  types.ts     — AccountIdentity, Signer, LocalSignerConfig, AccountAbstraction
  signer.ts    — LocalSigner class, createLocalSigner factory
  account.ts   — AccountAbstractionImpl (private), factory functions
  index.ts     — barrel export
```

The module imports only from `src/types` (Layer 0) and `src/utils` (Layer 1),
consistent with the Layer 2 position in the existing module hierarchy. No
feature module needs to be modified; the new module sits alongside `wallet`,
`payments`, `transactions`, and `soroban`.

All new symbols are re-exported from `src/index.ts` (the package root) to
maintain the single-entry-point contract established in ADR 0001.

## Alternatives Considered

### 1. Extend `WalletKeypair` with an optional `signer` field

Adding `signer?: Signer` to `WalletKeypair` would require changing existing
function signatures or introducing overloads, and it still conflates identity
with secret-key holding. Rejected: backwards compatibility risk, still couples
the two concerns.

### 2. Rename / repurpose `WalletKeypair`

Changing `WalletKeypair` to carry a `Signer` would be a breaking change for
existing consumers. Rejected: violates the backwards-compatibility principle in
ADR 0001.

### 3. Introduce `Account` class only (no factory functions)

A class constructor is natural for the `AccountAbstractionImpl` but creates
friction for callers who want a one-liner. Factory functions (`createLocalAccount`,
`createReadOnlyAccount`) are idiomatic for the SDK's functional style (as
established by `createWallet`, `importWallet`, etc.). The implementation class
is kept private; the public surface is factory functions + the `AccountAbstraction`
interface. Accepted as the primary approach.

### 4. Integrate signing directly into existing wallet/payments modules

We could add a `signer?: Signer` parameter to `sendXLM` and vault helpers
instead of introducing a new module. This was deferred: it would change existing
function signatures and is best done as a follow-up once the abstraction layer
is stable and adopted.

## Consequences

### Positive

- **Safety**: code paths that only need a public key receive an `AccountIdentity`
  with no secret material — no accidental leakage.
- **Extensibility**: external signers (hardware wallets, HSMs, MPC) plug in
  behind the `Signer` interface without touching any existing SDK code.
- **Consistency**: `createLocalAccount` follows the same naming and factory
  pattern as `createWallet`, `importWallet`, and `resolveConfig`.
- **Testability**: external signer behaviour is easy to stub with a plain object
  satisfying the `Signer` interface.
- **No breaking changes**: all existing exports and function signatures are
  unchanged. The new module is purely additive.

### Negative / Trade-offs

- **Two models for a while**: `WalletKeypair` and `AccountAbstraction` overlap.
  Consumers must choose which model suits their call site. Documentation and
  examples mitigate this but do not eliminate the cognitive cost.
- **Additional surface area**: five new exports (two types, one class, three
  factories) plus the `createLocalSigner` helper add maintenance burden.
- **Existing modules not yet updated**: `sendXLM`, `depositToVault`, and
  `withdrawFromVault` still accept a raw `sourceSecret` string. Migrating them
  to accept an `AccountAbstraction` is a follow-on task (see roadmap).

### Neutral

- This ADR does not change error handling, configuration, network behaviour, or
  existing test expectations.
- Any future migration of `sendXLM` to accept an `AccountAbstraction` would be
  recorded in a superseding ADR.

## References

- [Issue #159 — Design SDK account abstraction layer](https://github.com/Axionvera/pocketpay-sdk/issues/159)
- [ADR 0001 — SDK API Design Principles](./0001-api-design-principles.md)
- [Account Abstraction Documentation](../account-abstraction.md)
- [Architecture Overview](../architecture.md)
- [Security Best Practices](../security.md)
