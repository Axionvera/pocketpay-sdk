/**
 * Stellar PocketPay SDK â€” Wallet Module
 *
 * Create, import, and manage Stellar keypairs. Query balances. Fund testnet accounts.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getFriendbotUrl, resolveConfig } from '../config';
import {
  WalletKeypair, AccountBalance, AssetBalance,
  BalanceResult, FundResult, PocketPayError, SDKConfig, PocketPayResult, EnhancedPocketPayResult,
} from '../types';
import { validatePublicKey, validateSecretKey, wrapError, toResult, toEnhancedSuccessResult, toEnhancedFailureResult, toEnhancedResult } from '../utils';
import type { ResultWarning, RecoveryHint } from '../errors';
import { NetworkClient, withTimeout } from '../network';

/**
 * Creates a new random Stellar keypair.
 *
 * @remarks **This does not activate the account on-chain** (see
 * {@link fundTestnetAccount} for testnet) and **the SDK does not persist or
 * back up the returned keys in any way** — `secretKey` exists only in the
 * value returned here. If it's lost, access to the account is lost
 * permanently; there is no recovery mechanism. The consuming app or user is
 * responsible for backing it up (e.g. encrypted storage, a secure vault, or
 * a user-facing recovery phrase flow) immediately after calling this
 * function. See the [Security Best Practices guide](../../docs/security.md)
 * for guidance, and avoid logging `secretKey` — see the
 * [Logging Guidance](../../docs/logging.md).
 *
 * @returns A {@link WalletKeypair} with a freshly generated `publicKey` and
 *   `secretKey`.
 *
 * @example
 * ```ts
 * const wallet = createWallet();
 * console.log('Public Key:', wallet.publicKey); // safe to log
 * // Persist wallet.secretKey to secure storage now — it cannot be recovered later.
 * ```
 */
export function createWallet(): WalletKeypair {
  const kp = StellarSDK.Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

/**
 * Imports an existing wallet from a secret key.
 *
 * @remarks Use this to restore a wallet from a secret key the consuming app
 * or user backed up after a prior {@link createWallet} call — the SDK itself
 * does not store or retrieve keys on your behalf.
 *
 * @param secretKey - Stellar secret key (S...) to import
 * @returns A {@link WalletKeypair} derived from the given secret key
 * @throws {PocketPayError} `INVALID_SECRET_KEY` if the secret key is malformed
 */
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

/**
 * Fetches the full account balance for a Stellar public key.
 *
 * @param publicKey - Stellar public key (G...)
 * @param config - Optional SDK config overrides
 * @returns The account balance with all asset entries
 * @throws {PocketPayError} with code `INVALID_PUBLIC_KEY` for invalid keys,
 *   `ACCOUNT_NOT_FOUND` (status 404) for unfunded accounts, or `BALANCE_ERROR`
 *   for network/Horizon failures.
 */
export async function getBalance(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<AccountBalance> {
  validatePublicKey(publicKey);
  return _loadAccountBalance(publicKey, config);
}

/**
 * Fetches balance but returns a discriminated union instead of throwing for
 * unfunded accounts.
 *
 * - `{ status: "funded", publicKey, balance }` — the account exists on-chain.
 * - `{ status: "unfunded", publicKey }` — Horizon returned 404.
 *
 * Non-404 errors (5xx, network failures, etc.) are still thrown so genuine
 * failures are never silently swallowed.
 *
 * @param publicKey - Stellar public key (G...)
 * @param config - Optional SDK config overrides
 * @returns A {@link BalanceResult} discriminated union
 */
export async function getBalanceOrUnfunded(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<BalanceResult> {
  validatePublicKey(publicKey);
  try {
    const balance = await _loadAccountBalance(publicKey, config);
    return { status: 'funded' as const, publicKey, balance };
  } catch (error) {
    if (error instanceof PocketPayError && error.code === 'ACCOUNT_NOT_FOUND') {
      return { status: 'unfunded' as const, publicKey };
    }
    throw error;
  }
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
  const cfg = resolveConfig(config);
  try {
    const account = await withTimeout(
      'Horizon account lookup',
      cfg.timeout,
      server.loadAccount(publicKey),
    );
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
export async function fundTestnetAccount(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<FundResult> {
  validatePublicKey(publicKey);
  const cfg = resolveConfig(config);
  if (cfg.network !== 'testnet') {
    throw new PocketPayError(
      'fundTestnetAccount is only available on testnet. ' +
      'Set STELLAR_NETWORK=testnet or pass { network: "testnet" } to resolveConfig.',
      'TESTNET_ONLY',
      {
        validation: {
          field: 'network',
          reason: 'not_testnet',
          value: cfg.network
        }
      }
    );
  }
  try {
    const client = new NetworkClient({
      baseUrl: getFriendbotUrl(),
      defaultTimeoutMs: cfg.timeout,
    });
    const data = await client.get<Record<string, unknown>>(
      `?addr=${encodeURIComponent(publicKey)}`,
      {
        operation: 'Friendbot funding request',
      },
    );
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
    if (error instanceof PocketPayError) {
      // Map general HTTP errors to Friendbot-specific error code
      if (error.code.startsWith('HTTP_ERROR_')) {
        throw new PocketPayError(
          error.message,
          'FRIENDBOT_ERROR',
          error.statusCode,
          error.cause,
        );
      }
      if (error.code === 'NETWORK_ERROR') {
        throw new PocketPayError(
          error.message,
          'FUND_ERROR',
          error.statusCode,
          error.cause,
        );
      }
      throw error;
    }
    throw wrapError(error, 'Failed to fund testnet account', 'FUND_ERROR');
  }
}

// ─── Safe Wrappers ──────────────────────────────────────────────────────────

export async function safeGetBalance(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<AccountBalance>> {
  return toResult(() => getBalance(publicKey, config), 'Failed to fetch balance', 'BALANCE_ERROR');
}

export async function safeFundTestnetAccount(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<FundResult>> {
  return toResult(() => fundTestnetAccount(publicKey, config), 'Failed to fund testnet account', 'FUND_ERROR');
}

/**
 * Fetches balance with an enriched result containing warnings and recovery hints.
 *
 * This is a pilot of the enhanced result pattern for balance queries. It wraps
 * {@link getBalance} and returns an {@link EnhancedPocketPayResult} that may
 * include:
 * - **Warnings** when the account has zero native XLM or has many assets
 *   (potential spam).
 * - **Recovery hints** on failure to guide the consumer toward a fix (e.g.
 *   "fund_account" for unfunded accounts, "check_network" for network errors).
 *
 * @param publicKey - Stellar public key (G...) to query
 * @param config - Optional SDK config overrides
 * @returns An enriched result with optional warnings and recovery hints
 */
export async function enhancedGetBalance(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<EnhancedPocketPayResult<AccountBalance>> {
  const warnings: ResultWarning[] = [];
  const recoveryHints: RecoveryHint[] = [];

  try {
    const balance = await getBalance(publicKey, config);

    if (balance.nativeBalance === '0.0000000' || balance.nativeBalance === '0') {
      warnings.push({
        code: 'ZERO_NATIVE_BALANCE',
        message: 'The account has no native XLM balance. Operations requiring XLM fees will fail.',
      });
    }

    if (balance.balances.length > 20) {
      warnings.push({
        code: 'MANY_ASSETS',
        message: `The account holds ${balance.balances.length} assets. Some wallets may have trouble displaying them all.`,
        metadata: { assetCount: balance.balances.length },
      });
    }

    return toEnhancedSuccessResult(balance, warnings, recoveryHints);
  } catch (error) {
    const pocketErr =
      error instanceof PocketPayError
        ? error
        : wrapError(error, 'Failed to fetch balance', 'BALANCE_ERROR');

    if (pocketErr.code === 'ACCOUNT_NOT_FOUND') {
      recoveryHints.push({
        action: 'fund_account',
        message: 'This account has not been funded yet. Use fundTestnetAccount() on testnet to activate it.',
        retryable: false,
      });
    }

    if (pocketErr.code === 'BALANCE_ERROR') {
      recoveryHints.push({
        action: 'check_network',
        message: 'Could not reach the Stellar Horizon server. Check your network connection and try again.',
        retryable: true,
        suggestedDelayMs: 2000,
      });
    }

    if (pocketErr.validation) {
      recoveryHints.push({
        action: 'check_input',
        message: `Fix the ${pocketErr.validation.field} field: ${pocketErr.validation.reason}.`,
        retryable: false,
      });
    }

    return toEnhancedFailureResult(pocketErr, warnings, recoveryHints);
  }
}

/**
 * Non-throwing wrapper for {@link enhancedGetBalance}.
 *
 * @param publicKey - Stellar public key (G...) to query
 * @param config - Optional SDK config overrides
 * @returns An enriched result that never throws
 */
export async function safeEnhancedGetBalance(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<EnhancedPocketPayResult<AccountBalance>> {
  return toEnhancedResult(() => getBalance(publicKey, config), {
    errorContext: 'Failed to fetch balance',
    errorCode: 'BALANCE_ERROR',
  });
}

