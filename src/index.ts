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
  SortableTransaction,
  TransactionSortOrder,
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
  safeGetBalance,
  safeFundTestnetAccount,
} from './wallet';

// ─── Payments ───────────────────────────────────────────────────────────────
export {
  sendXLM,
  safeSendXLM,
} from './payments';

// ─── Transactions ───────────────────────────────────────────────────────────
export {
  getTransactions,
  getPayments,
  filterTransactions,
  filterByDirection,
  filterByAsset,
  filterByDateRange,
  filterByCounterparty,
  sortTransactionsByDate,
  safeGetTransactions,
  safeGetPayments,
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
} from './utils';

