/**
 * Stellar PocketPay SDK — Wallet Module
 *
 * Create, import, and manage Stellar keypairs. Query balances. Fund testnet accounts.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getFriendbotUrl, resolveConfig } from '../config';
import {
  WalletKeypair, AccountBalance, AssetBalance,
  BalanceResult, FundResult, PocketPayError, SDKConfig,
} from '../types';
import { validatePublicKey, validateSecretKey, wrapError } from '../utils';

/** Creates a new random Stellar keypair. Does NOT activate it on-chain. */
export function createWallet(): WalletKeypair {
  const kp = StellarSDK.Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

/** Imports an existing wallet from a secret key. */
export function importWallet(secretKey: string): WalletKeypair {
  validateSecretKey(secretKey);
  const kp = StellarSDK.Keypair.fromSecret(secretKey);
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

/** Derives the public key from a secret key. */
export function getPublicKey(secretKey: string): string {
  validateSecretKey(secretKey);
  return StellarSDK.Keypair.fromSecret(secretKey).publicKey();
}

// ─── Private helpers ────────────────────────────────────────────────────────

/**
 * Internal: loads and maps Horizon balances for a public key.
 * Throws PocketPayError with ACCOUNT_NOT_FOUND (status 404) if unfunded,
 * or BALANCE_ERROR for any other failure.
 */
async function _loadAccountBalance(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<AccountBalance> {
  const server = getHorizonServer(config);
  try {
    const account = await server.loadAccount(publicKey);
    const balances: AssetBalance[] = account.balances.map((bal: any) => {
      if (bal.asset_type === 'native') {
        return { asset: 'XLM', balance: bal.balance, issuer: '' };
      }
      return {
        asset: bal.asset_code || 'unknown',
        balance: bal.balance,
        issuer: bal.asset_issuer || '',
      };
    });
    const native = balances.find((b) => b.asset === 'XLM');
    return { publicKey, balances, nativeBalance: native?.balance ?? '0' };
  } catch (error) {
    if (error instanceof Error && (error as any).response?.status === 404) {
      throw new PocketPayError(
        `Account not found: ${publicKey}. It may not be funded yet.`,
        'ACCOUNT_NOT_FOUND', 404,
      );
    }
    throw wrapError(error, 'Failed to fetch balance', 'BALANCE_ERROR');
  }
}

// ─── Public functions ───────────────────────────────────────────────────────

/**
 * Fetches all asset balances for a Stellar account.
 *
 * @param publicKey - Stellar public key (G...) to query
 * @param config - Optional SDK config overrides
 * @returns {@link AccountBalance} with all asset balances and native XLM shortcut
 * @throws {PocketPayError} with code `ACCOUNT_NOT_FOUND` (HTTP 404) if the
 *   account has never been funded, or `BALANCE_ERROR` for other Horizon failures
 *
 * @see {@link getBalanceOrUnfunded} for a non-throwing alternative that returns
 *   a discriminated union instead of throwing on unfunded accounts.
 */
export async function getBalance(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<AccountBalance> {
  validatePublicKey(publicKey);
  return _loadAccountBalance(publicKey, config);
}

/**
 * Fetches the balance for a Stellar account, returning a discriminated
 * {@link BalanceResult} instead of throwing when the account is unfunded.
 *
 * This is the recommended balance helper for **mobile app onboarding** and
 * any UI that must cleanly handle the "wallet created but not yet funded"
 * state (e.g. after Friendbot funding or before a first deposit).
 *
 * | Result `status` | Meaning |
 * |---|---|
 * | `"funded"` | Account exists; `result.balance` contains full balance data. |
 * | `"unfunded"` | Horizon returned 404; account has never been funded. |
 *
 * Unexpected errors (Horizon 5xx, network failures, etc.) are **not** swallowed
 * — they are still thrown as {@link PocketPayError} with code `BALANCE_ERROR`.
 *
 * @param publicKey - Stellar public key (G...) to query
 * @param config - Optional SDK config overrides
 * @returns A {@link BalanceResult} with `status: "funded"` or `"unfunded"`
 * @throws {PocketPayError} with code `INVALID_PUBLIC_KEY` for a bad key, or
 *   `BALANCE_ERROR` for unexpected Horizon/network failures
 *
 * @example
 * ```ts
 * const result = await getBalanceOrUnfunded(wallet.publicKey);
 *
 * if (result.status === 'unfunded') {
 *   // Guide the user to fund their new wallet
 *   await fundTestnetAccount(wallet.publicKey);
 *   return;
 * }
 *
 * // result.status === 'funded'
 * console.log('XLM balance:', result.balance.nativeBalance);
 * ```
 */
export async function getBalanceOrUnfunded(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<BalanceResult> {
  validatePublicKey(publicKey);
  try {
    const balance = await _loadAccountBalance(publicKey, config);
    return { status: 'funded', publicKey, balance };
  } catch (error) {
    if (error instanceof PocketPayError && error.code === 'ACCOUNT_NOT_FOUND') {
      return { status: 'unfunded', publicKey };
    }
    throw error;
  }
}

/**
 * Funds a testnet account via Friendbot (≈10,000 XLM).
 *
 * @remarks **Testnet only.** Calling this on mainnet throws immediately without
 * making any network request. Use the `network` config or the
 * `STELLAR_NETWORK` environment variable to set the active network.
 *
 * @param publicKey - Stellar public key (G...) of the account to fund
 * @returns A {@link FundResult} with the funded public key, transaction hash,
 *   ledger number, timestamp, fee, and Friendbot source account on success;
 *   or a descriptive `error` message on failure.
 * @throws {PocketPayError} with code `TESTNET_ONLY` if not on testnet,
 *   `INVALID_PUBLIC_KEY` for an invalid public key, `FRIENDBOT_ERROR` for
 *   non-2xx HTTP responses, or `FUND_ERROR` for network/fetch failures.
 *
 * @example
 * ```ts
 * const result = await fundTestnetAccount(wallet.publicKey);
 * if (result.success) {
 *   console.log('Funded! tx hash:', result.hash, 'ledger:', result.ledger);
 * }
 * ```
 */
export async function fundTestnetAccount(publicKey: string): Promise<FundResult> {
  validatePublicKey(publicKey);
  const cfg = resolveConfig();
  if (cfg.network !== 'testnet') {
    throw new PocketPayError(
      'fundTestnetAccount is only available on testnet. ' +
      'Set STELLAR_NETWORK=testnet or pass { network: "testnet" } to resolveConfig.',
      'TESTNET_ONLY',
    );
  }
  try {
    const resp = await fetch(`${getFriendbotUrl()}?addr=${encodeURIComponent(publicKey)}`);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '(no body)');
      throw new PocketPayError(
        `Friendbot HTTP ${resp.status}: ${body}`,
        'FRIENDBOT_ERROR',
        resp.status,
      );
    }
    const data = (await resp.json()) as Record<string, unknown>;
    return {
      success: true,
      publicKey,
      hash: typeof data['hash'] === 'string' ? data['hash'] : undefined,
      friendbotId: typeof data['id'] === 'string' ? data['id'] : undefined,
      ledger: typeof data['ledger'] === 'number' ? data['ledger'] : undefined,
      createdAt: typeof data['created_at'] === 'string' ? data['created_at'] : undefined,
      feeCharged: typeof data['fee_charged'] === 'string' ? data['fee_charged'] : undefined,
      friendbotAccount: typeof data['source_account'] === 'string' ? data['source_account'] : undefined,
    };
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Failed to fund testnet account', 'FUND_ERROR');
  }
}
