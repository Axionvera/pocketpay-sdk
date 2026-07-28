# ADR 0004: Signer Capability Architecture

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** PocketPay SDK maintainers
- **Type:** Feature / Architecture
- **Supersedes:** Extends [ADR-0002](./0002-account-abstraction.md) (does not
  replace it)

## Context

[ADR-0002](./0002-account-abstraction.md) introduced `AccountIdentity`,
`Signer`, `LocalSigner`, and `AccountAbstraction`, separating account
identity from signing capability. It explicitly deferred one item under
"Negative / Trade-offs": *"Existing modules not yet updated: `sendXLM`,
`depositToVault`, and `withdrawFromVault` still accept a raw `sourceSecret`
string. Migrating them to accept an `AccountAbstraction` is a follow-on
task."*

Auditing the codebase for this follow-on task found:

1. **Two independent build→sign→submit pipelines.** `src/payments/index.ts`
   (`sendXLM`/`sendAsset`) builds, signs, and submits in one function using a
   raw `sourceSecret` string — it never touches `AccountAbstraction`/`Signer`.
   `src/transactions/offline-preparation.ts` is a separate, genuinely staged
   armado → firma → submit pipeline (`prepareTransactionOffline` →
   `fetchNetworkState` → `buildUnsignedTransaction` → `signTransaction` /
   `signTransactionWithSigner` → `submitSignedTransaction`) that already had
   a signer-based signing step, but it duck-typed the signer parameter
   instead of importing the real `Signer` type, and did not accept an
   `AccountAbstraction` at all.
2. **No capability check before signing.** Nothing verified
   `canSignTransaction` or an equivalent before attempting to sign in either
   pipeline — a read-only account had no code path to be rejected early.
3. **No typed errors for signer misuse.** `signTransactionWithSigner`
   compared the signer's public key to the transaction's source account and
   threw on mismatch, but with an unregistered ad hoc code (`'KEY_MISMATCH'`)
   instead of a code from the public `ErrorCode` standard
   (`src/errors/codes.ts`). A read-only account's `sign()` threw a plain
   `Error`, not a `PocketPayError`, breaking the SDK-wide invariant that
   every thrown error is a `PocketPayError` with a stable code.
4. **No formal external signer adapter contract.** `Signer` already served
   this role structurally, but nothing distinguished "any object with a
   `sign()` method" from an adapter meant to bridge to a specific external
   transport (hardware, mobile, browser), and there was no error code for an
   adapter to report "I can't do this yet."
5. **A latent secret-serialization gap in `LocalSigner`.** Auditing "no
   secret in serialization" (a requirement for this change) found that
   `@stellar/stellar-sdk`'s `Keypair` stores the raw secret key as plain
   enumerable `Buffer` fields (`_secretSeed`, `_secretKey`). Since
   `LocalSigner` held a `Keypair` as a regular own property, `JSON.stringify(signer)`
   and Node's `console.log(signer)`/`util.inspect(signer)` both serialized
   the raw secret key bytes — even though no *type* in the account
   abstraction layer declared a `secretKey` field. This predates this ADR
   and was not introduced by it, but is fixed as part of it (see Decision,
   item 5).

**Concurrent work note:** while this change was in review, a separate,
concurrently-developed PR (#284/#299, merged the same day) implemented
`docs/capability_error_standard.md` for real — `UnsupportedFeatureError`,
`CapabilityMismatchError` (both `PocketPayError` subclasses), the
`SDK_CAPABILITIES` registry, and `assertCapability()`
(`src/errors/unsupported.ts`, `src/errors/capabilities.ts`). It already
registers `'signer.remote'` as a `planned` capability — the same "external
signer not implemented yet" case this ADR's `ExternalSignerAdapter` extension
point covers. This ADR was revised after that merge (see Decision, items 3
and 4, and Alternatives Considered, item B) to reuse that standard for the
"unsupported capability" case instead of introducing a parallel,
signer-specific mechanism.

## Decision

### 1. `AccountAbstraction` becomes a discriminated union

`AccountAbstraction` changes from a single interface with
`signer: Signer | undefined` and `canSign: boolean` (independently typed, so
`canSign` did not narrow `signer` at compile time) to
`ReadOnlyAccount | SigningAccount`, discriminated on the literal `canSign`
field:

```ts
interface ReadOnlyAccount { canSign: false; signer: undefined; /* ... */ }
interface SigningAccount  { canSign: true;  signer: Signer;    /* ... */ }
type AccountAbstraction = ReadOnlyAccount | SigningAccount;
function canSignTransaction(account: AccountAbstraction): account is SigningAccount;
```

This is additive at the value level — `createReadOnlyAccount`,
`createLocalAccount`, and `createAccountWithSigner` return the same runtime
shape as before, cast to the precise branch inside the (already-internal)
`AccountAbstractionImpl` factory functions. `ReadOnlyAccount.sign()` is kept
(rather than removed from the read-only branch) so existing call sites that
invoke `.sign()` without checking `canSign` first keep compiling and keep
rejecting the same way — only the thrown value's type changes (see item 3).

### 2. `signWithAccount()` — capability-checked orchestration

A new function in `src/transactions/offline-preparation.ts`:

```ts
async function signWithAccount(unsigned: UnsignedTransaction, account: AccountAbstraction): Promise<SignedTransaction>
```

Checks `canSignTransaction(account)` (→ `TX_SIGNER_MISSING` if false), then
`account.publicKey === unsigned.sourcePublicKey` (→ `TX_SIGNER_MISMATCH` if
not), then delegates to the existing `signTransactionWithSigner`. A
non-throwing `safeSignWithAccount` wraps it. Neither
`signTransaction(unsigned, secretKey)` nor
`signTransactionWithSigner(unsigned, signer)` change behaviour;
`signTransactionWithSigner`'s parameter type was tightened from a locally
duplicated duck type to the real `Signer` type (structurally compatible with
anything that already satisfied the duck type).

`src/payments/index.ts` (`sendXLM`/`sendAsset`) and `src/soroban/index.ts`
(`depositToVault`/`withdrawFromVault`) are **not** changed — they keep
accepting a raw `sourceSecret` string exactly as before. Migrating them is
still open (see Alternatives Considered, item 4 of ADR-0002).

### 3. Typed, registered signer errors

Two codes added to `src/errors/codes.ts` (category `Transaction`):
`TX_SIGNER_MISSING`, `TX_SIGNER_MISMATCH`. Both are thrown as
`PocketPayError`, never a bare `Error`. `ReadOnlyAccount.sign()`'s rejection
and `signTransactionWithSigner`'s mismatch check were both migrated from a
plain `Error`/unregistered `'KEY_MISMATCH'` string onto this standard.

These two are deliberately **not** modeled through `UnsupportedFeatureError`/
`CapabilityMismatchError`/`SDK_CAPABILITIES` (see Context — concurrent work
note): that system gates SDK-wide, statically-registered capabilities
(`'vault.contract'`, `'signer.remote'`, ...) that are either configured or
not for the whole SDK instance. "This specific account instance has no
signer attached" and "this specific signer doesn't match this specific
transaction" are per-call-site conditions, not capability gates — there is
nothing to register in `SDK_CAPABILITIES` for them. They follow the same
base pattern (`PocketPayError` + registered `code`), just without the
`module`/`operation`/`capability` structured context that only makes sense
for capability-gated features.

### 4. `ExternalSignerAdapter` — a named extension point, not an implementation

```ts
interface ExternalSignerAdapter extends Signer {
  readonly kind: 'hardware' | 'mobile' | 'browser' | 'remote';
  readonly isAvailable: boolean;
}
```

Structurally a `Signer`, so it works with `createAccountWithSigner` today
with no other change. No concrete hardware/mobile/browser adapter is
implemented by this ADR — this is the contract a future adapter package (or
the consuming app) implements.

Unlike "missing signer" / "wrong signer" (item 3), "this adapter can't
fulfil this request" **is** a capability-gating question, and one the
concurrently-merged capability standard already models:
`SDK_CAPABILITIES['signer.remote']` is registered as `'planned'`. An adapter
that can't fulfil a request calls
`assertCapability('signer.remote', false, { module: 'account', operation: 'sign' })`,
which throws `UnsupportedFeatureError`; `signWithAccount` propagates that
unchanged (it never catches, wraps, or reinterprets a signer's error). No
signer-specific "unsupported" error code was added — it would duplicate this
mechanism.

### 5. `LocalSigner` no longer serializes its secret

`LocalSigner` gained a `toJSON()` (for `JSON.stringify`) and a
`[Symbol.for('nodejs.util.inspect.custom')]` method (for
`console.log`/`util.inspect`), both returning only `{ publicKey }`. This
closes the gap described in Context, item 5, without changing the
constructor, storage, or signing behaviour.

## Alternatives Considered

### A. Keep `AccountAbstraction` as a plain interface, rely on `if (account.signer)`

`if (account.signer)` already narrows `signer` correctly in TypeScript
without any type change. Rejected in favor of the discriminated union
because `canSign` — the property the existing docs and tests present as the
primary capability check — did not itself narrow anything; a caller writing
`if (account.canSign) { account.signer.sign(...) }` still needed a non-null
assertion. The union makes `canSign` and `signer` correlated at the type
level, matching how the API is actually documented and used.

### B. A dedicated `TX_CAPABILITY_UNSUPPORTED` code for unsupported signer adapters

This ADR originally planned a signer-specific `TX_CAPABILITY_UNSUPPORTED`
code for the "adapter can't fulfil this request" case, on the reasoning that
the SDK has one error class (`PocketPayError`) identified by a stable `code`,
and that a doc stub proposing separate `UnsupportedFeatureError`/
`CapabilityMismatchError` classes (`docs/capability_error_standard.md`) was,
at the time, unimplemented.

That reasoning was overtaken by events: a concurrent PR (see Context)
implemented exactly that stub — `UnsupportedFeatureError` and
`CapabilityMismatchError` as `PocketPayError` subclasses (so
`error instanceof PocketPayError` still holds), plus `SDK_CAPABILITIES` and
`assertCapability()`, and registered `'signer.remote': { status: 'planned' }`
— already covering this exact case. Rejected in favor of reusing that
standard: adding `TX_CAPABILITY_UNSUPPORTED` on top would give the SDK two
different, overlapping ways to say "this isn't supported yet," which is
worse for consumers than either option alone. `TX_SIGNER_MISSING`/
`TX_SIGNER_MISMATCH` are unaffected — see Decision, item 3, for why they stay
as plain registered codes rather than moving to the capability-error classes
too.

### C. Change `sendXLM`/`sendAsset` to accept `AccountAbstraction`

Would directly close the "follow-on task" from ADR-0002. Deferred again:
`sendXLM`/`sendAsset` are outside the audited scope for this change (which
targeted the armado → firma → submit orchestration in
`src/transactions/`), and changing their parameter shape — even additively
— is a larger, separately-reviewable change. Left as future work.

### D. Reuse the existing but unused `WALLET_KEYPAIR_MISMATCH` error code for "wrong signer"

`ErrorCode.WALLET_KEYPAIR_MISMATCH` is registered but was never thrown
anywhere. Rejected in favor of a new `TX_SIGNER_MISMATCH`: reusing it would
require deciding whether an unthrown-but-exported code counts as "published"
under the stability guarantee in `src/errors/codes.ts`, and its documented
semantics ("secret does not derive this public key") are narrower than "this
signer instance does not match this account" (which also covers external
signers with no secret key at all).

## Consequences

### Positive

- Read-only vs. signing-capable is enforced by the type checker at the call
  site, not just by convention.
- A missing or wrong signer is caught before any signer is invoked, with a
  stable, registered error code.
- The external signer extension point (mobile/browser/hardware) is now named
  and typed, ready for a future adapter package with no SDK core changes.
- A real, previously-unnoticed secret-serialization gap in `LocalSigner` is
  closed.
- Zero breaking changes: `WalletKeypair`, `createWallet`, `importWallet`,
  `sendXLM`, `sendAsset`, `depositToVault`, `withdrawFromVault`,
  `signTransaction`, `signTransactionWithSigner`, and the pre-existing
  `AccountAbstraction`/`LocalSigner` factory functions all keep their
  existing signatures and behaviour (verified: full existing test suite
  passes unchanged).

### Negative / Trade-offs

- `AccountAbstraction` is now a union rather than a single interface; a
  consumer with an explicit `const s: Signer | undefined = account.signer`
  type annotation would need to narrow first — no such usage existed in this
  codebase's tests or examples.
- Two more public error codes to maintain indefinitely (stable once
  published, per `src/errors/codes.ts`).
- `sendXLM`/`sendAsset`/vault helpers remain on the raw-secret path; the SDK
  still has two signing models side by side until a future change addresses
  Alternative C.

### Neutral

- Does not change configuration, network behaviour, or the transaction
  history/query modules.

## References

- [ADR-0002 — Account Abstraction Layer](./0002-account-abstraction.md)
- [Account Abstraction Documentation](../account-abstraction.md)
- [Signing Boundaries](../signing-boundaries.md)
- [Capability Error Standard](../capability_error_standard.md)
- [Security Best Practices](../security.md)
