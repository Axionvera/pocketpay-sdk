import {
  NATIVE_ASSET,
  isNativeAsset,
  isIssuedAsset,
  validateAsset,
  assertValidAsset,
  formatAsset,
  parseAssetString,
  areAssetsEqual,
  Asset,
  IssuedAsset,
} from '../../src';

const VALID_ISSUER = 'GBAU2A3P3VBAJ2R6IUZTL735PVD4OHRRL3AOHXWTYLOH765P6I34J4GH';
const SECOND_ISSUER = 'GCX2233633644556677889900AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPP';

describe('Typed Asset Model', () => {
  describe('Native XLM Asset', () => {
    it('correctly identifies native XLM asset', () => {
      expect(NATIVE_ASSET.type).toBe('native');
      expect(NATIVE_ASSET.code).toBe('XLM');
      expect(isNativeAsset(NATIVE_ASSET)).toBe(true);
      expect(isIssuedAsset(NATIVE_ASSET)).toBe(false);
    });

    it('passes validation for native XLM', () => {
      const res = validateAsset(NATIVE_ASSET);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(() => assertValidAsset(NATIVE_ASSET)).not.toThrow();
    });

    it('fails validation if native asset code is not XLM', () => {
      const badNative = { type: 'native', code: 'USD' } as unknown as Asset;
      const res = validateAsset(badNative);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Native asset code must be "XLM"');
    });
  });

  describe('Issued Asset Validation', () => {
    it('validates AlphaNum4 issued asset', () => {
      const usdAsset: IssuedAsset = {
        type: 'issued',
        code: 'USD',
        issuer: VALID_ISSUER,
      };
      expect(isIssuedAsset(usdAsset)).toBe(true);
      expect(validateAsset(usdAsset).valid).toBe(true);
    });

    it('validates AlphaNum12 issued asset', () => {
      const longAsset: IssuedAsset = {
        type: 'issued',
        code: 'STELLARCODE1',
        issuer: VALID_ISSUER,
      };
      expect(validateAsset(longAsset).valid).toBe(true);
    });

    it('fails validation if issued asset code is empty or > 12 characters', () => {
      const emptyCode = { type: 'issued', code: '', issuer: VALID_ISSUER } as Asset;
      expect(validateAsset(emptyCode).valid).toBe(false);

      const tooLongCode = {
        type: 'issued',
        code: 'VERYLONGASSETNAME',
        issuer: VALID_ISSUER,
      } as Asset;
      expect(validateAsset(tooLongCode).valid).toBe(false);
    });

    it('fails validation if issued asset code is XLM', () => {
      const xlmIssued = { type: 'issued', code: 'XLM', issuer: VALID_ISSUER } as Asset;
      const res = validateAsset(xlmIssued);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Issued asset code cannot be XLM');
    });

    it('fails validation if issuer public key is invalid', () => {
      const badIssuer = { type: 'issued', code: 'USD', issuer: 'INVALID_G_KEY' } as Asset;
      const res = validateAsset(badIssuer);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('valid Stellar public key');
    });

    it('throws when assertValidAsset receives an invalid asset', () => {
      const invalidAsset = { type: 'issued', code: '', issuer: '' } as Asset;
      expect(() => assertValidAsset(invalidAsset)).toThrow('Invalid Asset:');
    });
  });

  describe('Formatting and Parsing', () => {
    it('formats native asset as XLM', () => {
      expect(formatAsset(NATIVE_ASSET)).toBe('XLM');
    });

    it('formats issued asset as CODE:ISSUER', () => {
      const asset: IssuedAsset = { type: 'issued', code: 'USDC', issuer: VALID_ISSUER };
      expect(formatAsset(asset)).toBe(`USDC:${VALID_ISSUER}`);
    });

    it('parses XLM and native string representations', () => {
      expect(parseAssetString('XLM')).toEqual(NATIVE_ASSET);
      expect(parseAssetString('xlm')).toEqual(NATIVE_ASSET);
      expect(parseAssetString('native')).toEqual(NATIVE_ASSET);
    });

    it('parses CODE:ISSUER string representation', () => {
      const str = `USDC:${VALID_ISSUER}`;
      const parsed = parseAssetString(str);
      expect(parsed).toEqual({
        type: 'issued',
        code: 'USDC',
        issuer: VALID_ISSUER,
      });
    });

    it('throws error when parsing malformed strings', () => {
      expect(() => parseAssetString('')).toThrow();
      expect(() => parseAssetString('USDC')).toThrow('Cannot parse asset string');
      expect(() => parseAssetString('USDC:INVALID_ISSUER')).toThrow();
    });
  });

  describe('Asset Equality', () => {
    it('returns true for two native assets', () => {
      expect(areAssetsEqual(NATIVE_ASSET, { type: 'native', code: 'XLM' })).toBe(true);
    });

    it('returns true for matching issued assets', () => {
      const a: IssuedAsset = { type: 'issued', code: 'USD', issuer: VALID_ISSUER };
      const b: IssuedAsset = { type: 'issued', code: 'USD', issuer: VALID_ISSUER };
      expect(areAssetsEqual(a, b)).toBe(true);
    });

    it('returns false when code or issuer differs', () => {
      const a: IssuedAsset = { type: 'issued', code: 'USD', issuer: VALID_ISSUER };
      const diffCode: IssuedAsset = { type: 'issued', code: 'EUR', issuer: VALID_ISSUER };
      const diffIssuer: IssuedAsset = { type: 'issued', code: 'USD', issuer: SECOND_ISSUER };

      expect(areAssetsEqual(a, diffCode)).toBe(false);
      expect(areAssetsEqual(a, diffIssuer)).toBe(false);
    });

    it('returns false when comparing native vs issued asset', () => {
      const issued: IssuedAsset = { type: 'issued', code: 'XLM', issuer: VALID_ISSUER };
      expect(areAssetsEqual(NATIVE_ASSET, issued)).toBe(false);
    });
  });
});
