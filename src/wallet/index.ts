/**
 * Stellar PocketPay SDK — Wallet Module
 *
 * Create, import, and manage Stellar keypairs. Query balances. Fund testnet accounts.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getFriendbotUrl, resolveConfig } from '../config';
import {
  WalletKeypair, AccountBalance, AssetBalance,
  FundResult, PocketPayError, SDKConfig,
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

/** Fetches all asset balances for a Stellar account. */
export async function getBalance(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<AccountBalance> {
  validatePublicKey(publicKey);
  try {
    const server = getHorizonServer(config);
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
        'ACCOUNT_NOT_FOUND', 404
      );
    }
    throw wrapError(error, 'Failed to fetch balance', 'BALANCE_ERROR');
  }
}

/** Funds a testnet account via Friendbot (10,000 XLM). Testnet only. */
export async function fundTestnetAccount(publicKey: string): Promise<FundResult> {
  validatePublicKey(publicKey);
  const cfg = resolveConfig();
  if (cfg.network !== 'testnet') {
    throw new PocketPayError('Friendbot is only available on testnet', 'TESTNET_ONLY');
  }
  try {
    const resp = await fetch(`${getFriendbotUrl()}?addr=${encodeURIComponent(publicKey)}`);
    if (!resp.ok) {
      const body = await resp.text();
      throw new PocketPayError(`Friendbot HTTP ${resp.status}: ${body}`, 'FRIENDBOT_ERROR', resp.status);
    }
    const data: any = await resp.json();
    return { success: true, hash: data.hash || data.id || 'unknown' };
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Failed to fund testnet account', 'FUND_ERROR');
  }
}
