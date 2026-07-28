/**
 * Stellar PocketPay SDK — Account Abstraction Types
 *
 * Defines the core abstractions that separate wallet identity, signing
 * capability, public account data, and transaction authorisation.
 *
 * Design goals
 * ─────────────
 * 1. Identity (what the account *is*) is always just a public key.  Nothing
 *    about how it signs or whether a secret key is available locally.
 * 2. Signing (what the account *can do* cryptographically) lives behind the
 *    `Signer` interface so local keypairs and future external signers
 *    (hardware wallets, MPC signers, passkey-backed signers) are all
 *    interchangeable.
 * 3. `AccountAbstraction` ties an identity to an optional signer, providing
 *    the minimal surface a consuming module needs for either read-only or
 *    read-write access.
 */

import type * as StellarSDK from '@stellar/stellar-sdk';

// ─── Identity ───────────────────────────────────────────────────────────────

/**
 * The public, shareable identity of a Stellar account.
 *
 * This type intentionally carries no secret-key material. It can be stored,
 * logged, or passed across module boundaries without creating a key-leakage
 * risk.
 */
export interface AccountIdentity {
  /**
   * The Stellar public key (G...) that uniquely identifies this account
   * on the network.
   */
  readonly publicKey: string;
}

// ─── Signer Interface ────────────────────────────────────────────────────────

/**
 * A capability interface for signing Stellar transactions.
 *
 * Any object that can sign a `Transaction` or `FeeBumpTransaction` satisfies
 * this interface — a local keypair, a hardware wallet bridge, a remote HSM
 * proxy, or a multisig coordinator all look the same to code that uses
 * `Signer`.
 *
 * @remarks
 * The `sign` method mutates the transaction in-place (the Stellar SDK's
 * `Transaction.sign()` model) **and** returns it, so callers can either rely
 * on mutation or use the return value — both patterns are valid.
 *
 * External signer implementations (hardware wallets, remote HSMs) should
 * return a Promise so they can perform async I/O without blocking.
 */
export interface Signer {
  /**
   * The public key that corresponds to the signing key held by this signer.
   * Used to verify that the signer matches the account identity it is paired
   * with.
   */
  readonly publicKey: string;

  /**
   * Signs the given transaction.
   *
   * @param transaction - The built (but not yet signed) Stellar transaction.
   *   The implementation may mutate this object in-place.
   * @param networkPassphrase - The network passphrase required by the Stellar
   *   signing algorithm (e.g. `"Test SDF Network ; September 2015"`).
   * @returns The signed transaction (same object, with signature applied).
   *
   * @example
   * ```ts
   * const signed = await signer.sign(tx, networkPassphrase);
   * await server.submitTransaction(signed);
   * ```
   */
  sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction>;
}

// ─── Local Signer ────────────────────────────────────────────────────────────

/**
 * Configuration for creating a {@link LocalSigner}.
 *
 * The `secretKey` is the only piece of sensitive material in the account
 * abstraction layer.  It is intentionally segregated here so that code paths
 * that only need the identity or the public-facing account data never touch it.
 */
export interface LocalSignerConfig {
  /**
   * The Stellar secret key (S...) used for signing.
   *
   * @security Never log or transmit this value. Store it in encrypted
   *   storage and clear it from memory when it is no longer needed.
   */
  secretKey: string;
}

// ─── External Signer Adapter ─────────────────────────────────────────────────

/**
 * Extension point for signers backed by an external device or service
 * (hardware wallet, mobile app, browser extension, remote HSM/MPC signer).
 *
 * This is a **contract only** — no concrete adapter ships in SDK core. A
 * future package (or the consuming app) implements this interface and passes
 * an instance to {@link createAccountWithSigner}.
 *
 * @remarks
 * `ExternalSignerAdapter` is structurally a {@link Signer}, so anything that
 * accepts a `Signer` already accepts an `ExternalSignerAdapter` — the two
 * extra fields exist so consumers can branch on transport (`kind`) and probe
 * reachability (`isAvailable`) without attempting a sign first.
 *
 * The SDK's capability registry already tracks this extension point under
 * `'signer.remote'` (see `SDK_CAPABILITIES`, `src/errors/capabilities.ts`),
 * currently `status: 'planned'`. An adapter that cannot fulfil a request
 * should signal that through the SDK's existing unsupported-feature standard
 * — `assertCapability('signer.remote', false, { module: 'account', operation: 'sign' })`,
 * which throws {@link UnsupportedFeatureError} — rather than inventing a new
 * error path. See `docs/capability_error_standard.md` for the full standard.
 */
export interface ExternalSignerAdapter extends Signer {
  /**
   * The transport/device family this adapter bridges to. Purely descriptive —
   * the SDK does not branch on this value.
   */
  readonly kind: 'hardware' | 'mobile' | 'browser' | 'remote';

  /**
   * Cheap, synchronous capability probe: `true` when this adapter is wired up
   * in the current build/runtime (e.g. the browser extension is installed).
   *
   * `isAvailable === true` does **not** guarantee `sign()` will succeed — the
   * device can still be disconnected, locked, or reject the request when
   * `sign()` is actually called. Callers that need a hard guarantee must
   * still handle rejection from `sign()` itself — an `UnsupportedFeatureError`
   * (via `assertCapability`) or a transport-specific error the adapter defines.
   */
  readonly isAvailable: boolean;
}

// ─── Account Abstraction ─────────────────────────────────────────────────────

/**
 * A read-only account: identity only, no signer attached. `canSign` is
 * always `false` and `signer` is always `undefined` — enforced at the type
 * level so `if (account.canSign)` narrows out the possibility of a signer in
 * both directions.
 *
 * `sign()` is still present (so existing call sites that don't check
 * `canSign` first keep compiling) but always rejects with a typed
 * `PocketPayError` (`TX_SIGNER_MISSING`).
 */
export interface ReadOnlyAccount {
  readonly identity: AccountIdentity;
  readonly signer: undefined;
  readonly canSign: false;
  readonly publicKey: string;
  sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction>;
}

/**
 * A signing-capable account: identity plus an attached {@link Signer}.
 * `canSign` is always `true` and `signer` is always present — enforced at
 * the type level.
 */
export interface SigningAccount {
  readonly identity: AccountIdentity;
  readonly signer: Signer;
  readonly canSign: true;
  readonly publicKey: string;
  sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction>;
}

/**
 * An account abstraction that binds a public {@link AccountIdentity} to an
 * optional {@link Signer}.
 *
 * This is a discriminated union on `canSign` — TypeScript narrows `signer`
 * from `Signer | undefined` down to exactly `Signer` (or exactly `undefined`)
 * once you branch on `canSign`, without a cast or a try/catch:
 *
 * ```ts
 * if (canSignTransaction(account)) {
 *   // account: SigningAccount — account.signer is Signer, not Signer | undefined
 *   await account.signer.sign(tx, passphrase);
 * } else {
 *   // account: ReadOnlyAccount
 * }
 * ```
 *
 * - **Read-only accounts** ({@link ReadOnlyAccount}) hold only an
 *   `AccountIdentity` and no signer. Useful for balance queries, transaction
 *   history, and any read path that does not require signing.
 * - **Signing accounts** ({@link SigningAccount}) additionally hold a
 *   `Signer` implementation and can authorise transactions.
 *
 * Typical usage:
 * ```ts
 * // Read-only: observe a third-party account
 * const observer = createReadOnlyAccount('GXXX...');
 *
 * // Local wallet: create or import a keypair and link it
 * const wallet = createLocalAccount('SXXX...');
 * const signed = await wallet.sign(tx, passphrase);
 * ```
 */
export type AccountAbstraction = ReadOnlyAccount | SigningAccount;

/**
 * Type guard: checks whether an {@link AccountAbstraction} can sign, and
 * narrows it to {@link SigningAccount} when it can.
 *
 * Prefer this over calling `sign()` inside a try/catch — it lets the
 * capability check happen (and be branched on) before any signing attempt.
 *
 * @example
 * ```ts
 * if (!canSignTransaction(account)) {
 *   // account: ReadOnlyAccount — handle the read-only case explicitly
 *   return;
 * }
 * // account: SigningAccount from here on
 * await account.signer.sign(tx, networkPassphrase);
 * ```
 */
export function canSignTransaction(account: AccountAbstraction): account is SigningAccount {
  return account.canSign;
}
