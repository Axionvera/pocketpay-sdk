/**
 * Stellar PocketPay SDK — Account Module
 *
 * Provides the account abstraction layer that separates wallet identity,
 * signing capability, public account data, and transaction authorisation.
 *
 * Public API
 * ──────────
 * Types:
 *   - `AccountIdentity`     — public key identity; no secrets
 *   - `Signer`              — interface for any signing implementation
 *   - `LocalSignerConfig`   — configuration for a local (in-memory) signer
 *   - `AccountAbstraction`  — identity + optional signer, the main handle
 *
 * Classes:
 *   - `LocalSigner`         — `Signer` implementation backed by a local keypair
 *
 * Factory functions:
 *   - `createReadOnlyAccount(publicKey)`      — identity only, no signing
 *   - `createLocalAccount(secretKey)`         — identity + LocalSigner
 *   - `createAccountWithSigner(identity, signer?)` — identity + custom signer
 *   - `createLocalSigner(secretKey)`          — standalone LocalSigner helper
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  AccountIdentity,
  Signer,
  LocalSignerConfig,
  AccountAbstraction,
} from './types';

// ─── Signer implementations ──────────────────────────────────────────────────
export { LocalSigner, createLocalSigner } from './signer';

// ─── Account factories ───────────────────────────────────────────────────────
export {
  createReadOnlyAccount,
  createLocalAccount,
  createAccountWithSigner,
} from './account';
