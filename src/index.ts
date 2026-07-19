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
  BalanceResult,
  SendXLMParams,
  PaymentResult,
  TransactionSummary,
  TransactionRecord,
  TransactionList,
  TransactionDirection,
  FilterableTransaction,
  FilterTransactionsOptions,
  PaymentSummary,
  PaymentRecord,
  PaymentList,
  VaultDepositParams,
  VaultWithdrawParams,
  VaultBalanceParams,
  VaultResult,
  FundResult,
  SuccessResult,
  FailureResult,
  PocketPayResult,
} from './types';

export { PocketPayError } from './types';

// ─── Wallet ─────────────────────────────────────────────────────────────────
export {
  createWallet,
  importWallet,
  getPublicKey,
  getBalance,
  getBalanceOrUnfunded,
  fundTestnetAccount,
} from './wallet';

// ─── Payments ───────────────────────────────────────────────────────────────
export { sendXLM } from './payments';

// ─── Transactions ───────────────────────────────────────────────────────────
export {
  getTransactions,
  getPayments,
  filterTransactions,
  filterByDirection,
  filterByAsset,
  filterByDateRange,
  filterByCounterparty,
} from './transactions';

// ─── Soroban Vault ──────────────────────────────────────────────────────────
export { depositToVault, withdrawFromVault, getVaultBalance } from './soroban';

// ─── Config ─────────────────────────────────────────────────────────────────
export {
  resolveConfig,
  getHorizonServer,
  setHorizonServerFactory,
  resetHorizonServerFactory,
  getNetworkPassphrase,
  getFriendbotUrl,
  validateNetwork,
  validateHorizonUrl,
  validateSorobanRpcUrl,
  validateTimeout,
  validateContractId,
} from './config';

// ─── Utils ──────────────────────────────────────────────────────────────────
export {
  validatePublicKey,
  validateSecretKey,
  validateAmount,
  validateMemo,
  validateTransactionHash,
  stroopsToXLM,
  xlmToStroops,
  truncateAddress,
  // Redaction
  redactSecretKey,
  redactSensitiveValue,
  // Result helpers
  toSuccessResult,
  toFailureResult,
  toResult,
  // Asset helpers
  findAssetBalance,
  // Safe (non-throwing) wrappers
  safeGetBalance,
  safeFundTestnetAccount,
  safeSendXLM,
  safeGetTransactions,
  safeGetPayments,
} from './utils';