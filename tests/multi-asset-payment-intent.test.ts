import { describe, expect, it, vi } from 'vitest';
import {
  checkPaymentIntentTrustline,
  createPaymentIntent,
  evaluateAssetState,
  validatePaymentIntent,
} from '../src/payments/intent';
import { areAssetsEqual } from '../src/types';
import {
  ISSUED_EURT_FIXTURE,
  ISSUED_USDC_FIXTURE,
  MALFORMED_ASSETS_FIXTURE,
  NATIVE_XLM_FIXTURE,
  RESTRICTED_ASSET_METADATA_FIXTURE,
  USDC_METADATA_FIXTURE,
  VALID_DESTINATION_G,
  VALID_ISSUER_USDC,
  VALID_SOURCE_G,
} from './fixtures/multi-asset-fixtures';

describe('Multi-Asset Payment Intent Model', () => {
  describe('Asset Representation & Equality', () => {
    it('distinctly represents native XLM asset', () => {
      expect(NATIVE_XLM_FIXTURE.type).toBe('native');
      expect(NATIVE_XLM_FIXTURE.code).toBe('XLM');
    });

    it('distinctly represents issued asset (USDC)', () => {
      expect(ISSUED_USDC_FIXTURE.type).toBe('issued');
      expect(ISSUED_USDC_FIXTURE.code).toBe('USDC');
      expect(ISSUED_USDC_FIXTURE.issuer).toBe(VALID_ISSUER_USDC);
    });

    it('correctly compares asset equality via areAssetsEqual', () => {
      expect(areAssetsEqual(NATIVE_XLM_FIXTURE, { type: 'native', code: 'XLM' })).toBe(true);
      expect(areAssetsEqual(ISSUED_USDC_FIXTURE, { type: 'issued', code: 'USDC', issuer: VALID_ISSUER_USDC })).toBe(true);
      expect(areAssetsEqual(NATIVE_XLM_FIXTURE, ISSUED_USDC_FIXTURE)).toBe(false);
      expect(areAssetsEqual(ISSUED_USDC_FIXTURE, ISSUED_EURT_FIXTURE)).toBe(false);
    });
  });

  describe('Asset State Evaluation', () => {
    it('evaluates native XLM as supported', () => {
      expect(evaluateAssetState(NATIVE_XLM_FIXTURE)).toBe('supported');
    });

    it('evaluates valid issued asset as supported', () => {
      expect(evaluateAssetState(ISSUED_USDC_FIXTURE, USDC_METADATA_FIXTURE)).toBe('supported');
    });

    it('evaluates restricted asset as restricted', () => {
      expect(evaluateAssetState(ISSUED_USDC_FIXTURE, RESTRICTED_ASSET_METADATA_FIXTURE)).toBe('restricted');
    });

    it('evaluates malformed assets as unsupported', () => {
      expect(evaluateAssetState(MALFORMED_ASSETS_FIXTURE.invalidType)).toBe('unsupported');
      expect(evaluateAssetState(MALFORMED_ASSETS_FIXTURE.emptyCode)).toBe('unsupported');
      expect(evaluateAssetState(MALFORMED_ASSETS_FIXTURE.xlmAsIssued)).toBe('unsupported');
    });
  });

  describe('Payment Intent Creation & Metadata', () => {
    it('creates a valid Native XLM payment intent', () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: VALID_DESTINATION_G,
        amount: '10.5000000',
        asset: NATIVE_XLM_FIXTURE,
        memo: 'Order #1001',
      });

      expect(intent.id).toMatch(/^pi_\d+_[a-z0-9]+$/);
      expect(intent.status).toBe('valid');
      expect(intent.assetState).toBe('supported');
      expect(intent.asset.type).toBe('native');
      expect(intent.validationResult?.valid).toBe(true);
      expect(intent.validationResult?.issues).toHaveLength(0);
    });

    it('creates a valid Issued Asset payment intent with metadata', () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: VALID_DESTINATION_G,
        amount: '100.0000000',
        asset: ISSUED_USDC_FIXTURE,
        assetMetadata: USDC_METADATA_FIXTURE,
        memo: 'Invoice payment',
        metadata: { checkoutId: 'chk_12345' },
      });

      expect(intent.status).toBe('valid');
      expect(intent.assetState).toBe('supported');
      expect(intent.assetMetadata?.name).toBe('USD Coin');
      expect(intent.assetMetadata?.domain).toBe('centre.io');
      expect(intent.metadata?.checkoutId).toBe('chk_12345');
    });
  });

  describe('Validation & Malformed Input Handling', () => {
    it('flags invalid destination address in preflight validation', () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: 'INVALID_DESTINATION_ADDRESS',
        amount: '10.0000000',
        asset: NATIVE_XLM_FIXTURE,
      });

      expect(intent.status).toBe('invalid');
      expect(intent.validationResult?.valid).toBe(false);
      expect(intent.validationResult?.issues.some((i) => i.field === 'destination')).toBe(true);
    });

    it('flags invalid amount precision or negative amount', () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: VALID_DESTINATION_G,
        amount: '-5.0',
        asset: NATIVE_XLM_FIXTURE,
      });

      expect(intent.status).toBe('invalid');
      expect(intent.validationResult?.issues.some((i) => i.field === 'amount')).toBe(true);
    });

    it('flags malformed asset (issued XLM)', () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: VALID_DESTINATION_G,
        amount: '10.0000000',
        asset: MALFORMED_ASSETS_FIXTURE.xlmAsIssued,
      });

      expect(intent.status).toBe('unsupported_asset');
      expect(intent.assetState).toBe('unsupported');
      expect(intent.validationResult?.valid).toBe(false);
    });
  });

  describe('Trustline Check Strategy', () => {
    it('returns hasTrustline = true for Native XLM without network lookup', async () => {
      const intent = createPaymentIntent({
        source: VALID_SOURCE_G,
        destination: VALID_DESTINATION_G,
        amount: '10.0000000',
        asset: NATIVE_XLM_FIXTURE,
      });

      const result = await checkPaymentIntentTrustline(intent);
      expect(result.hasTrustline).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
