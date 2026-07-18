/**
 * Stellar PocketPay SDK â€” Wallet Module
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

// â”€â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Balance queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetches the on-chain balances for a Stellar account.
 *
 * @param publicKey - Stellar public key (G...)
 * @param config - Optional SDK config overrides
 * @returns The account's {@link AccountBalance}
 * @throws {PocketPayError} `INVALID_PUBLIC_KEY` for an invalid key,
 *   `ACCOUNT_NOT_FOUND` (404) if the account is not funded, or
 *   `BALANCE_ERROR` for any other failure.
 *
 * @example
 * ```ts
 * const balance = await getBalance(wallet.publicKey);
 * console.log('XLM:', balance.nativeBalance);
 * ```
 */
export async function getBalance(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<AccountBalance> {
  validatePublicKey(publicKey);
  return _loadAccountBalance(publicKey, config);
}

/**
 * Like {@link getBalance}, but returns a {@link BalanceResult} that
 * distinguishes a funded account from an unfunded one instead of throwing
 * `ACCOUNT_NOT_FOUND`. Any other failure still throws.
 *
 * @param publicKey - Stellar public key (G...)
 * @param config - Optional SDK config overrides
 * @returns A {@link BalanceResult}: `{ funded: true, balance }` when the
 *   account exists, or `{ funded: false, publicKey }` when it is not yet funded.
 * @throws {PocketPayError} `INVALID_PUBLIC_KEY` for an invalid key, or
 *   `BALANCE_ERROR` for a non-404 failure.
 *
 * @example
 * ```ts
 * const result = await getBalanceOrUnfunded(wallet.publicKey);
 * if (result.funded) {
 *   console.log('XLM:', result.balance.nativeBalance);
 * } else {
 *   console.log('Account not funded yet:', result.publicKey);
 * }
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
 * Funds a testnet account via Friendbot (â‰ˆ10,000 XLM).
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
