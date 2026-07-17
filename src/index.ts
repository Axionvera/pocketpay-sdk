/**
 * Stellar PocketPay SDK
 *
 * Reusable TypeScript helper package for Stellar PocketPay and other Stellar Testnet apps.
 *
 * @packageDocumentation
 */

import * as dotenv from 'dotenv';
dotenv.config();

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  StellarNetwork,
  SDKConfig,
  WalletKeypair,
  AssetBalance,
  AccountBalance,
  SendXLMParams,
  PaymentResult,
  TransactionRecord,
  TransactionList,
  PaymentRecord,
  PaymentList,
  VaultDepositParams,
  VaultWithdrawParams,
  VaultBalanceParams,
  VaultResult,
  FundResult,
} from './types';

export { PocketPayError } from './types';

// ─── Wallet ─────────────────────────────────────────────────────────────────
export {
  createWallet,
  importWallet,
  getPublicKey,
  getBalance,
  fundTestnetAccount,
} from './wallet';

// ─── Payments ───────────────────────────────────────────────────────────────
export { sendXLM } from './payments';

// ─── Transactions ───────────────────────────────────────────────────────────
export { getTransactions, getPayments } from './transactions';

// ─── Soroban Vault ──────────────────────────────────────────────────────────
export { depositToVault, withdrawFromVault, getVaultBalance } from './soroban';

// ─── Config ─────────────────────────────────────────────────────────────────
export {
  resolveConfig,
  getHorizonServer,
  getNetworkPassphrase,
  getFriendbotUrl,
} from './config';

// ─── Utils ──────────────────────────────────────────────────────────────────
export {
  validatePublicKey,
  validateSecretKey,
  validateAmount,
  validateMemo,
  stroopsToXLM,
  xlmToStroops,
  truncateAddress,
} from './utils';