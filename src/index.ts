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
  ConfigIssueSeverity,
  ConfigValidationIssue,
  ConfigValidationResult,
  WalletKeypair,
  AssetBalance,
  AccountBalance,
  BalanceResult,
  SendXLMParams,
  SendAssetParams,
  PaymentPreviewParams,
  PaymentPreview,
  PaymentResult,
  TransactionSummary,
  TransactionRecord,
  TransactionList,
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
  VaultMappedResult,
  VaultOperationType,
  SorobanInvocationStatus,
  SorobanInvocationResult,
  SorobanInvocationMapperOptions,
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
  // ─── Typed Asset Model ─────────────────────────────────────────────────────
  Asset,
  NativeAsset,
  IssuedAsset,
  AssetValidationResult,
  // ─── Multi-Asset Balance Model ──────────────────────────────────────────────
  AssetBalanceState,
  AccountBalanceState,
  NativeAssetBalanceItem,
  IssuedAssetBalanceItem,
  UnknownAssetBalanceItem,
  AssetBalanceItem,
  MultiAssetBalance,
  MultiAssetBalanceResult,
  // ─── Retry Policy ──────────────────────────────────────────────────────────
  SubmissionOutcome,
  RetryPolicy,
  RetryPolicyExhaustedResult,
} from './types';

export {
  PocketPayError,
  TransactionDirection,
  TransactionStatus,
  // ─── Typed Asset Model Exports ─────────────────────────────────────────────
  NATIVE_ASSET,
  isNativeAsset,
  isIssuedAsset,
  validateAsset,
  assertValidAsset,
} from './types';

// ─── Error Enrichment Types ────────────────────────────────────────────────
export type { ResultWarning, RecoveryHint } from './errors';

// ─── Wallet ─────────────────────────────────────────────────────────────────
export {
  createWallet,
  importWallet,
  safeImportWallet,
  enhancedImportWallet,
  safeEnhancedImportWallet,
  getPublicKey,
  getBalance,
  getBalanceOrUnfunded,
  fundTestnetAccount,
  safeGetBalance,
  safeFundTestnetAccount,
  enhancedGetBalance,
  safeEnhancedGetBalance,
  // Multi-Asset Balance
  calculateNativeReserves,
  parseMultiAssetBalance,
  getMultiAssetBalance,
  safeGetMultiAssetBalance,
  formatAssetBalanceDisplay,
  findAssetInMultiBalance,
} from './wallet';

// ─── Payments ───────────────────────────────────────────────────────────────
export {
  sendXLM,
  safeSendXLM,
  enhancedSendXLM,
  safeEnhancedSendXLM,
  sendAsset,
  safeSendAsset,
  previewPayment,
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
export {
  ContractClient,
  createContractClient,
  VaultClient,
  createVaultClient,
  type ContractClientConfig,
  type ContractInvokeResult,
  type ReadOnlyCallOptions,
  type InvokeCallOptions,
  type ParamTypes,
  type ScValType,
  type ErrorMapping,
} from './soroban';
export {
  depositToVault,
  withdrawFromVault,
  getVaultBalance,
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
} from './soroban';

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
  validatePocketPayConfig,
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
  formatAsset,
  parseAssetString,
  areAssetsEqual,
  // Security helpers
  redactSensitive,
} from './utils';

