import {
  Asset,
  NATIVE_ASSET,
  isNativeAsset,
  isIssuedAsset,
  assertValidAsset,
} from '../types/asset';

/**
 * Formats an Asset into its standard string representation.
 * - Native: "XLM"
 * - Issued: "CODE:ISSUER" (e.g. "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WF2CCX3THRDU2C2FYM235AC2")
 */
export function formatAsset(asset: Asset): string {
  assertValidAsset(asset);
  if (isNativeAsset(asset)) {
    return 'XLM';
  }
  return `${asset.code}:${asset.issuer}`;
}

/**
 * Parses a string representation into a typed Asset object.
 * Accepts:
 * - "XLM" or "native" -> NativeAsset
 * - "CODE:ISSUER" -> IssuedAsset
 */
export function parseAssetString(assetStr: string): Asset {
  if (!assetStr || typeof assetStr !== 'string') {
    throw new Error('Asset string must be a non-empty string');
  }

  const trimmed = assetStr.trim();

  if (trimmed.toUpperCase() === 'XLM' || trimmed.toLowerCase() === 'native') {
    return NATIVE_ASSET;
  }

  const parts = trimmed.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const asset: Asset = {
      type: 'issued',
      code: parts[0].trim(),
      issuer: parts[1].trim(),
    };
    assertValidAsset(asset);
    return asset;
  }

  throw new Error(
    `Cannot parse asset string: "${assetStr}". Expected "XLM" or "CODE:ISSUER"`
  );
}

/**
 * Checks strict equality between two Asset objects.
 */
export function areAssetsEqual(a: Asset, b: Asset): boolean {
  if (a.type !== b.type) return false;
  if (isNativeAsset(a) && isNativeAsset(b)) return true;
  if (isIssuedAsset(a) && isIssuedAsset(b)) {
    return a.code === b.code && a.issuer === b.issuer;
  }
  return false;
}
