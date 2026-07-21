// ─── Soroban / Vault ────────────────────────────────────────────────────────

/**
 * Base parameters shared across all Soroban vault operations.
 */
export interface BaseVaultParams {
  /**
   * The Soroban vault contract ID (C...).
   * If omitted, the SDK automatically falls back to the `VAULT_CONTRACT_ID` environment variable.
   */
  contractId?: string;
}

/**
 * Parameters shared across state-changing vault transaction helpers (deposit, withdraw).
 */
export interface VaultTransactionParams extends BaseVaultParams {
  /**
   * The Stellar secret key (S...) of the account executing and signing the transaction.
   * This account must match the target vault user and fund transaction fees.
   */
  sourceSecret: string;
  /**
   * The amount of XLM for the operation as a string (e.g. `"100"`).
   * Converted internally to stroops (i128) by the SDK.
   */
  amount: string;
}

/**
 * Parameters for depositing XLM into the savings vault.
 */
export interface VaultDepositParams extends VaultTransactionParams {}

/**
 * Parameters for withdrawing XLM from the savings vault.
 */
export interface VaultWithdrawParams extends VaultTransactionParams {}

/**
 * Parameters for querying a user's available vault balance (read-only simulation).
 */
export interface VaultBalanceParams extends BaseVaultParams {
  /**
   * The Stellar public key (G...) of the user whose available vault balance is being queried.
   */
  publicKey: string;
}

/**
 * Result of a Soroban vault operation (deposit, withdraw, or balance query).
 */
export interface VaultResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Transaction hash (present on successful deposit/withdraw submissions) */
  hash?: string;
  /** Resulting balance in XLM (present on successful balance queries) */
  balance?: string;
  /** Human-readable error message if the operation failed */
  error?: string;
}