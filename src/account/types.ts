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

// ─── Account Abstraction ─────────────────────────────────────────────────────

/**
 * An account abstraction that binds a public {@link AccountIdentity} to an
 * optional {@link Signer}.
 *
 * - **Read-only accounts** hold only an `AccountIdentity` and no signer.
 *   They are useful for balance queries, transaction history, and any
 *   read path that does not require signing.
 * - **Signing accounts** additionally hold a `Signer` implementation.
 *   They can authorise transactions on behalf of the identity.
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
export interface AccountAbstraction {
  /**
   * The public identity of this account (public key only, no secrets).
   */
  readonly identity: AccountIdentity;

  /**
   * The signer attached to this account, or `undefined` for read-only
   * accounts.
   *
   * Consumers that need to sign should check this field (or use
   * {@link AccountAbstraction.canSign}) before attempting to sign.
   */
  readonly signer: Signer | undefined;

  /**
   * Convenience getter: `true` when a `Signer` is present.
   *
   * @example
   * ```ts
   * if (!account.canSign) {
   *   throw new Error('This account is read-only and cannot sign transactions.');
   * }
   * ```
   */
  readonly canSign: boolean;

  /**
   * Convenience getter: the public key of the identity (shorthand for
   * `account.identity.publicKey`).
   */
  readonly publicKey: string;

  /**
   * Signs a Stellar transaction using the attached signer.
   *
   * @param transaction - The built (but unsigned) transaction.
   * @param networkPassphrase - The network passphrase for the target network.
   * @returns The signed transaction.
   * @throws {Error} if no signer is attached (`canSign` is `false`).
   *
   * @example
   * ```ts
   * const tx = builder.build();
   * const signed = await account.sign(tx, Networks.TESTNET);
   * ```
   */
  sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction>;
}
