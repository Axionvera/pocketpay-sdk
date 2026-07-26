/**
 * Stellar PocketPay SDK — Multi-Asset Balance Model Types
 *
 * Types representing native XLM and issued credit assets in a rich, multi-asset
 * account balance model with availability, reserve breakdown, and display metadata.
 */

/**
 * State / status of a specific asset balance entry for an account.
 */
export type AssetBalanceState =
  | 'available'      // Asset balance is active and ready to spend/transfer
  | 'reserved'       // Portion or all of balance is encumbered by reserves or liabilities
  | 'unauthorized'   // Issued asset trustline exists but issuer authorization is lacking
  | 'unavailable'    // Asset data is currently unavailable from network/RPC
  | 'unknown';       // Asset state cannot be determined or parsed

/**
 * State / status of the overall account balance query.
 */
export type AccountBalanceState =
  | 'funded'         // Account exists on-chain with funded native/issued balances
  | 'unfunded'       // Account does not exist on-chain (404 / never funded)
  | 'unavailable'    // Network/Horizon call failed or endpoint degraded
  | 'unknown';       // Account status is unknown or unverified

/**
 * Represents native XLM asset balance with protocol reserve breakdown.
 */
export interface NativeAssetBalanceItem {
  /** Discriminant for native XLM */
  type: 'native';
  /** Always "XLM" */
  assetCode: 'XLM';
  /** Total XLM balance held (as decimal string, e.g. "100.0000000") */
  totalBalance: string;
  /** Available XLM balance that can be transferred (total - reservedBalance) */
  availableBalance: string;
  /** Reserved XLM balance required for account base reserve, subentries, and selling liabilities */
  reservedBalance: string;
  /** Selling liabilities in XLM from open DEX offers */
  sellingLiabilities: string;
  /** Buying liabilities in XLM from open DEX offers */
  buyingLiabilities: string;
  /** Number of subentries (trustlines, offers, signers, data entries) */
  subentryCount: number;
  /** State of this balance entry */
  state: AssetBalanceState;
  /** Formatted UI display string (e.g. "97.50 XLM") */
  formattedDisplay: string;
}

/**
 * Represents an issued credit asset balance (e.g. USDC, EURT).
 */
export interface IssuedAssetBalanceItem {
  /** Discriminant for issued credit asset */
  type: 'issued';
  /** Asset code (1-12 alphanumeric characters, e.g. "USDC") */
  assetCode: string;
  /** Stellar public key (G...) of the asset issuer */
  issuer: string;
  /** Total asset balance held (as decimal string, e.g. "50.0000000") */
  totalBalance: string;
  /** Available asset balance to transfer (total - sellingLiabilities) */
  availableBalance: string;
  /** Reserved balance (selling liabilities) */
  reservedBalance: string;
  /** Selling liabilities from open DEX offers */
  sellingLiabilities: string;
  /** Buying liabilities from open DEX offers */
  buyingLiabilities: string;
  /** Maximum trustline limit configured by the account holder */
  limit: string;
  /** Whether the trustline is authorized by the asset issuer */
  isAuthorized: boolean;
  /** State of this balance entry */
  state: AssetBalanceState;
  /** Formatted UI display string (e.g. "50.00 USDC") */
  formattedDisplay: string;
}

/**
 * Represents an asset balance entry whose details or issuer are unparseable or unavailable.
 */
export interface UnknownAssetBalanceItem {
  /** Discriminant for unknown or unverified asset */
  type: 'unknown';
  /** Asset code if available, or "UNKNOWN" */
  assetCode: string;
  /** Issuer public key if available */
  issuer?: string;
  /** Raw balance string if available */
  totalBalance: string;
  /** Available balance (default "0") */
  availableBalance: string;
  /** Reserved balance (default "0") */
  reservedBalance: string;
  /** State is always 'unknown' or 'unavailable' */
  state: 'unknown' | 'unavailable';
  /** Formatted UI display string */
  formattedDisplay: string;
}

/**
 * Union of all asset balance item variants.
 */
export type AssetBalanceItem =
  | NativeAssetBalanceItem
  | IssuedAssetBalanceItem
  | UnknownAssetBalanceItem;

/**
 * Comprehensive multi-asset account balance model.
 */
export interface MultiAssetBalance {
  /** Stellar public key (G...) of the account */
  publicKey: string;
  /** Overall account status ('funded' | 'unfunded' | 'unavailable' | 'unknown') */
  accountState: AccountBalanceState;
  /** Native XLM balance entry (undefined if account is unfunded or unavailable) */
  native?: NativeAssetBalanceItem;
  /** Array of issued asset balance entries */
  issuedAssets: IssuedAssetBalanceItem[];
  /** Array of unknown/unparseable balance entries (if any) */
  unknownAssets: UnknownAssetBalanceItem[];
  /** Total number of asset entries held by the account */
  totalAssetCount: number;
  /** ISO 8601 timestamp when the balance snapshot was taken */
  updatedAt: string;
}

/**
 * Result of a multi-asset balance query.
 */
export interface MultiAssetBalanceResult {
  /** Whether the balance query succeeded */
  success: boolean;
  /** The detailed multi-asset balance object */
  balance: MultiAssetBalance;
  /** Optional warning messages (e.g. low XLM reserve, many assets) */
  warnings?: string[];
  /** Optional human-readable error message on failure */
  error?: string;
}
