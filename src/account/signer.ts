/**
 * Stellar PocketPay SDK — LocalSigner
 *
 * Implements the `Signer` interface using a Stellar `Keypair` held in local
 * memory.  This is the default signer for wallets created or imported through
 * `createWallet` / `importWallet`.
 *
 * Security contract
 * ─────────────────
 * `LocalSigner` holds the raw secret key in memory for the lifetime of the
 * instance.  It is the caller's responsibility to:
 *
 *  1. Back up the secret key in encrypted storage immediately after obtaining
 *     it (the SDK never persists it).
 *  2. Avoid logging or transmitting the secret key.
 *  3. Clear the `LocalSigner` reference (allow it to be garbage-collected)
 *     when it is no longer needed, rather than keeping it alive longer than
 *     required.
 *
 * See docs/security.md for broader guidance.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import type { Signer, LocalSignerConfig } from './types';
import { validateSecretKey } from '../utils';

/**
 * A `Signer` backed by a Stellar `Keypair` held in local memory.
 *
 * Signing is synchronous under the hood (the Stellar SDK's `sign()` is
 * CPU-only), but the interface exposes an async contract so that local and
 * remote signers are interchangeable in consuming code.
 *
 * @example
 * ```ts
 * const signer = new LocalSigner({ secretKey: 'SXXX...' });
 * console.log(signer.publicKey); // G...
 *
 * const signed = await signer.sign(tx, Networks.TESTNET);
 * ```
 */
export class LocalSigner implements Signer {
  private readonly _keypair: StellarSDK.Keypair;

  /**
   * Creates a new `LocalSigner` from a Stellar secret key.
   *
   * @param config - Configuration holding the secret key.
   * @throws {PocketPayError} with code `INVALID_SECRET_KEY` if the secret
   *   key is malformed.
   */
  constructor(config: LocalSignerConfig) {
    // Validate before we touch the keypair so we surface a clear error early.
    validateSecretKey(config.secretKey);
    this._keypair = StellarSDK.Keypair.fromSecret(config.secretKey);
  }

  /**
   * The Stellar public key (G...) derived from the held secret key.
   */
  get publicKey(): string {
    return this._keypair.publicKey();
  }

  /**
   * Signs the given transaction in-place using the held keypair.
   *
   * The Stellar SDK's `Transaction.sign()` appends a signature to the
   * transaction's envelope.  The same transaction object is returned so
   * callers can chain or reassign as they prefer.
   *
   * @param transaction - The built (unsigned) transaction.
   * @param networkPassphrase - The network passphrase for the target network.
   * @returns The same transaction with the signature applied.
   */
  async sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction> {
    // The Stellar SDK's sign() mutates in-place; networkPassphrase is used
    // when computing the transaction hash that gets signed.
    transaction.sign(this._keypair);
    // networkPassphrase is already embedded in the transaction envelope via
    // TransactionBuilder — we accept it here to keep the Signer interface
    // symmetric with future async/remote signers that may need it explicitly.
    void networkPassphrase;
    return transaction;
  }
}

/**
 * Factory: creates a `LocalSigner` from a Stellar secret key string.
 *
 * Prefer this helper over `new LocalSigner(...)` when you want a one-liner.
 *
 * @param secretKey - Stellar secret key (S...)
 * @returns A new `LocalSigner` instance
 * @throws {PocketPayError} with code `INVALID_SECRET_KEY` if the key is malformed
 *
 * @example
 * ```ts
 * const signer = createLocalSigner('SXXX...');
 * const signed = await signer.sign(tx, Networks.TESTNET);
 * ```
 */
export function createLocalSigner(secretKey: string): LocalSigner {
  return new LocalSigner({ secretKey });
}
