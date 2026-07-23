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
  SendAssetParams,
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
  EnhancedSuccessResult,
  EnhancedFailureResult,
  EnhancedPocketPayResult,
  StellarAssetSpec,
  TrustlineStatus,
  TrustlineCheckResult,
  TrustlineCheckOptions,
  // ─── Retry Policy ──────────────────────────────────────────────────────────
  SubmissionOutcome,
  RetryPolicy,
  RetryPolicyExhaustedResult,
} from './types';

export { PocketPayError } from './types';

// ─── Error Enrichment Types ────────────────────────────────────────────────
export type { ResultWarning, RecoveryHint } from './errors';

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
  enhancedGetBalance,
  safeEnhancedGetBalance,
} from './wallet';

// ─── Payments ───────────────────────────────────────────────────────────────
export {
  sendXLM,
  safeSendXLM,
  enhancedSendXLM,
  safeEnhancedSendXLM,
  sendAsset,
  safeSendAsset,
  validateAssetSpec,
  checkDestinationTrustline,
  safeCheckDestinationTrustline,
  verifyPaymentTrustlineOrThrow,
  validateSendXLMParams,
} from './payments';

export type {
  ValidationError,
  ValidationErrorCode,
  ValidationErrorField,
  SendXLMValidationResult,
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
  // ─── Transaction Fixtures ──────────────────────────────────────────────────
  successfulPaymentSummary,
  failedPaymentSummary,
  pendingTransactionSummary,
  unknownTransactionSummary,
  transactionSummaryFixtures,
} from './transactions';

// ─── Soroban Vault ──────────────────────────────────────────────────────────
export { depositToVault, withdrawFromVault, getVaultBalance } from './soroban';

// ─── Network & Idempotency ──────────────────────────────────────────────────
export {
  submitTransactionIdempotently,
  pollTransactionStatus,
  withRetryPolicy,
} from './network';

// ─── Errors ─────────────────────────────────────────────────────────────────
export {
  classifySubmitError,
  isRetryableError,
  isUnknownStatusError,
  classifySubmissionOutcome,
  isSafeToRetry,
  requiresStatusCheck,
} from './errors';

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

// ─── Account Abstraction ─────────────────────────────────────────────────────
export type {
  AccountIdentity,
  Signer,
  LocalSignerConfig,
  AccountAbstraction,
} from './account';

export {
  LocalSigner,
  createLocalSigner,
  createReadOnlyAccount,
  createLocalAccount,
  createAccountWithSigner,
} from './account';

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
  // Explorer Links
  getAccountExplorerLink,
  getTransactionExplorerLink,
  getOperationExplorerLink,
  // Redaction
  redactSecretKey,
  redactSensitiveValue,
  // Result helpers
  toSuccessResult,
  toFailureResult,
  toResult,
  toEnhancedSuccessResult,
  toEnhancedFailureResult,
  toEnhancedResult,
  // Asset helpers
  findAssetBalance,
  // Security helpers
  redactSensitive,
} from './utils';

