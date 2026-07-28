export interface NativeAsset {
  type: 'native';
  code: 'XLM';
}

export interface IssuedAsset {
  type: 'issued';
  /** 1-12 alphanumeric characters (AlphaNum4 or AlphaNum12) */
  code: string;
  /** Valid 56-character Stellar G-address public key */
  issuer: string;
}

export type Asset = NativeAsset | IssuedAsset;

/** Immutable constant for native XLM */
export const NATIVE_ASSET: Readonly<NativeAsset> = Object.freeze({
  type: 'native',
  code: 'XLM',
});

// ==========================================
// Type Guards & Validation
// ==========================================

export function isNativeAsset(asset: Asset): asset is NativeAsset {
  return asset.type === 'native';
}

export function isIssuedAsset(asset: Asset): asset is IssuedAsset {
  return asset.type === 'issued';
}

const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;
const ASSET_CODE_REGEX = /^[a-zA-Z0-9]{1,12}$/;

export interface AssetValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates native and issued assets against Stellar network rules.
 */
export function validateAsset(asset: Asset): AssetValidationResult {
  if (!asset || typeof asset !== 'object') {
    return { valid: false, error: 'Asset must be an object' };
  }

  if (asset.type === 'native') {
    if (asset.code !== 'XLM') {
      return { valid: false, error: 'Native asset code must be "XLM"' };
    }
    return { valid: true };
  }

  if (asset.type === 'issued') {
    if (!asset.code || typeof asset.code !== 'string' || !ASSET_CODE_REGEX.test(asset.code)) {
      return { valid: false, error: 'Issued asset code must be 1-12 alphanumeric characters' };
    }

    if (asset.code.toUpperCase() === 'XLM') {
      return { valid: false, error: 'Issued asset code cannot be XLM' };
    }

    if (!asset.issuer || typeof asset.issuer !== 'string' || !STELLAR_PUBKEY_REGEX.test(asset.issuer)) {
      return { valid: false, error: 'Issued asset issuer must be a valid Stellar public key (starting with G)' };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Invalid asset type. Expected "native" or "issued"' };
}

/**
 * Throws an Error if the asset fails validation.
 */
export function assertValidAsset(asset: Asset): void {
  const result = validateAsset(asset);
  if (!result.valid) {
    throw new Error(`Invalid Asset: ${result.error}`);
  }
}
