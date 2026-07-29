// src/payments/qrParser.ts
import { validatePublicKey, validateAmount, validateMemoInput } from '../utils';
import { validateAssetSpec } from './trustline';
import type { StellarAssetSpec } from '../types';
import type { ValidationError } from './validation';

/**
 * Supported QR payload format (URL query string):
 *   pocketpay://pay?address=G...&amount=10.5&asset=USD:ISSUER&memo=hello&metadata=key1%3Avalue1%2Ckey2%3Avalue2
 *
 * - `address` (required): destination public key (Stellar G... address)
 * - `amount` (required): decimal string, positive, up to 7 decimal places
 * - `asset` (optional): "CODE:ISSUER" or "XLM"/"native"
 * - `memo` (optional): free‑form memo, max 28 bytes when encoded as UTF‑8
 * - `metadata` (optional): URL‑encoded comma‑separated key:value pairs, each value string
 */
export interface QRPayload {
  address: string;
  amount: string;
  asset?: StellarAssetSpec;
  memo?: string;
  metadata?: Record<string, string>;
}

export type QRParseResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; errors: ValidationError[] };

/**
 * Parse a QR payload string into structured data, performing validation.
 * Returns a structured result rather than throwing.
 */
export function parseQRPayload(input: string): QRParseResult {
  const errors: ValidationError[] = [];

  // Strip any scheme prefix (e.g. "pocketpay://pay?") and keep query part
  const queryStart = input.indexOf('?');
  const queryString = queryStart >= 0 ? input.slice(queryStart + 1) : input;
  const params = new URLSearchParams(queryString);

  const address = params.get('address');
  const amount = params.get('amount');
  const assetRaw = params.get('asset');
  const memo = params.get('memo') ?? undefined;
  const metadataRaw = params.get('metadata');

  // address validation
  if (!address) {
    errors.push({
      code: 'INVALID_PUBLIC_KEY',
      field: 'address',
      reason: 'missing',
      message: 'Destination address is required',
    });
  } else {
    try {
      validatePublicKey(address);
    } catch (e) {
      errors.push({
        code: 'INVALID_PUBLIC_KEY',
        field: 'address',
        reason: 'invalid_format',
        message: (e as Error).message,
      });
    }
  }

  // amount validation
  if (!amount) {
    errors.push({
      code: 'INVALID_AMOUNT',
      field: 'amount',
      reason: 'missing',
      message: 'Amount is required',
    });
  } else {
    try {
      validateAmount(amount);
    } catch (e) {
      errors.push({
        code: 'INVALID_AMOUNT',
        field: 'amount',
        reason: 'invalid_format',
        message: (e as Error).message,
      });
    }
  }

  // asset parsing & validation (optional)
  let asset: StellarAssetSpec | undefined = undefined;
  if (assetRaw) {
    const parts = assetRaw.split(':');
    if (parts.length === 1) {
      asset = { code: parts[0] } as StellarAssetSpec;
    } else if (parts.length === 2) {
      asset = { code: parts[0], issuer: parts[1] } as StellarAssetSpec;
    } else {
      errors.push({
        code: 'INVALID_ASSET',
        field: 'asset',
        reason: 'invalid_format',
        message: 'Asset must be "CODE" or "CODE:ISSUER"',
      });
    }
    if (asset) {
      try {
        validateAssetSpec(asset);
      } catch (e) {
        errors.push({
          code: 'INVALID_ASSET',
          field: 'asset',
          reason: 'invalid',
          message: (e as Error).message,
        });
      }
    }
  }

  // memo validation (optional)
  if (memo !== undefined) {
    try {
      validateMemoInput(memo);
    } catch (e) {
      errors.push({
        code: 'INVALID_MEMO',
        field: 'memo',
        reason: 'invalid_format',
        message: (e as Error).message,
      });
    }
  }

  // metadata parsing (optional). format: "key1:value1,key2:value2"
  let metadata: Record<string, string> | undefined = undefined;
  if (metadataRaw) {
    metadata = {};
    try {
      const decoded = decodeURIComponent(metadataRaw);
      const pairs = decoded.split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split(':');
        if (k && v) {
          metadata[k] = v;
        } else {
          throw new Error('Invalid metadata pair');
        }
      }
    } catch (e) {
      errors.push({
        code: 'INVALID_METADATA',
        field: 'metadata',
        reason: 'invalid_format',
        message: (e as Error).message,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const payload: QRPayload = {
    address: address!,
    amount: amount!,
    asset,
    memo,
    metadata,
  };
  return { ok: true, payload };
}
