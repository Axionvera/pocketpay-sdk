/**
 * Stellar PocketPay SDK — AccountAbstraction
 *
 * Ties a public `AccountIdentity` to an optional `Signer`, giving consumers a
 * single handle for both read-only account observation and transaction signing.
 *
 * Factory functions
 * ─────────────────
 * Rather than calling `new AccountAbstractionImpl(...)` directly, use the two
 * exported factory functions:
 *
 * - `createReadOnlyAccount(publicKey)` — identity only; cannot sign.
 * - `createLocalAccount(secretKey)`    — identity + `LocalSigner`; can sign.
 *
 * Both return the `AccountAbstraction` interface so callers are not coupled to
 * the concrete implementation class.
 */

import type * as StellarSDK from '@stellar/stellar-sdk';
import { validatePublicKey } from '../utils';
import { LocalSigner } from './signer';
import type { AccountAbstraction, AccountIdentity, Signer } from './types';

// ─── Concrete implementation ─────────────────────────────────────────────────

/**
 * Concrete implementation of `AccountAbstraction`.
 *
 * This class is intentionally kept internal. Consumers interact with it
 * through the `AccountAbstraction` interface and the two factory functions.
 */
class AccountAbstractionImpl implements AccountAbstraction {
  readonly identity: AccountIdentity;
  readonly signer: Signer | undefined;

  constructor(identity: AccountIdentity, signer?: Signer) {
    this.identity = identity;
    this.signer = signer;
  }

  get canSign(): boolean {
    return this.signer !== undefined;
  }

  get publicKey(): string {
    return this.identity.publicKey;
  }

  async sign(
    transaction: StellarSDK.Transaction | StellarSDK.FeeBumpTransaction,
    networkPassphrase: string,
  ): Promise<StellarSDK.Transaction | StellarSDK.FeeBumpTransaction> {
    if (!this.signer) {
      throw new Error(
        `Account ${this.identity.publicKey} is read-only and cannot sign transactions. ` +
        'Attach a Signer (e.g. via createLocalAccount) before calling sign().',
      );
    }
    return this.signer.sign(transaction, networkPassphrase);
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Creates a **read-only** `AccountAbstraction` from a Stellar public key.
 *
 * Use this when you need to observe or query an account (balance, history)
 * without holding a secret key — for example, a watch-only wallet or when
 * displaying another user's account.
 *
 * `canSign` will be `false`; calling `sign()` throws.
 *
 * @param publicKey - Stellar public key (G...)
 * @returns A read-only `AccountAbstraction`
 * @throws {PocketPayError} with code `INVALID_PUBLIC_KEY` if the key is malformed
 *
 * @example
 * ```ts
 * const account = createReadOnlyAccount('GXXX...');
 * console.log(account.publicKey);  // G...
 * console.log(account.canSign);    // false
 * ```
 */
export function createReadOnlyAccount(publicKey: string): AccountAbstraction {
  validatePublicKey(publicKey);
  const identity: AccountIdentity = { publicKey };
  return new AccountAbstractionImpl(identity);
}

/**
 * Creates a **signing-capable** `AccountAbstraction` from a Stellar secret key.
 *
 * The public key is derived automatically from the secret key via the Stellar
 * SDK.  A `LocalSigner` is attached so the account can sign transactions.
 *
 * `canSign` will be `true`; calling `sign()` signs the transaction in-place
 * using the local keypair.
 *
 * @param secretKey - Stellar secret key (S...)
 * @returns A signing-capable `AccountAbstraction`
 * @throws {PocketPayError} with code `INVALID_SECRET_KEY` if the key is malformed
 *
 * @example
 * ```ts
 * const account = createLocalAccount('SXXX...');
 * console.log(account.publicKey);  // derived G...
 * console.log(account.canSign);    // true
 *
 * const tx = builder.build();
 * const signed = await account.sign(tx, Networks.TESTNET);
 * ```
 */
export function createLocalAccount(secretKey: string): AccountAbstraction {
  // LocalSigner validates the secret key internally; the public key is
  // derived from the Stellar Keypair so it is always consistent.
  const signer = new LocalSigner({ secretKey });
  const identity: AccountIdentity = { publicKey: signer.publicKey };
  return new AccountAbstractionImpl(identity, signer);
}

/**
 * Creates an `AccountAbstraction` from an `AccountIdentity` and an optional
 * custom `Signer`.
 *
 * Use this when you need to plug in an external signer (hardware wallet,
 * remote HSM, passkey bridge, etc.).  If `signer` is omitted the account is
 * read-only.
 *
 * @param identity - The public identity of the account
 * @param signer   - Optional signer; omit for a read-only account
 * @returns An `AccountAbstraction` backed by the supplied signer
 *
 * @example
 * ```ts
 * // Bring-your-own signer (e.g. hardware wallet integration)
 * const account = createAccountWithSigner(
 *   { publicKey: 'GXXX...' },
 *   myHardwareWalletSigner,
 * );
 * ```
 */
export function createAccountWithSigner(
  identity: AccountIdentity,
  signer?: Signer,
): AccountAbstraction {
  validatePublicKey(identity.publicKey);
  return new AccountAbstractionImpl(identity, signer);
}
