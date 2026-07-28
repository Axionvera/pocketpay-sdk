import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveConfig,
  validatePocketPayConfig,
  resolveFeatureFlags,
  isFeatureEnabled,
  assertFeatureEnabled,
  DEFAULT_FEATURE_FLAGS,
  DisabledFeatureError,
  isDisabledFeatureError,
  ErrorCode,
  enableDiagnostics,
  disableDiagnostics,
  buildDiagnosticsReport,
  executeExperimentalVaultBatch,
  querySorobanEvents,
} from '../src';

describe('Feature Flags and Config Source Framework', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear out env vars that affect config testing
    delete process.env.STELLAR_NETWORK;
    delete process.env.STELLAR_HORIZON_URL;
    delete process.env.STELLAR_SOROBAN_RPC_URL;
    delete process.env.STELLAR_TIMEOUT;
    delete process.env.STELLAR_CONTRACT_ID;
    delete process.env.VAULT_CONTRACT_ID;
    delete process.env.POCKETPAY_FEATURE_FLAGS;
    delete process.env.STELLAR_FEATURE_FLAGS;
    delete process.env.POCKETPAY_FEATURE_EXPERIMENTAL_VAULT;
    delete process.env.STELLAR_FEATURE_EXPERIMENTAL_VAULT;
    disableDiagnostics();
  });

  afterEach(() => {
    process.env = originalEnv;
    disableDiagnostics();
  });

  describe('Configuration Source Metadata', () => {
    it('accurately identifies default config sources', () => {
      const config = resolveConfig();
      expect(config.sources.network).toBe('default');
      expect(config.sources.horizonUrl).toBe('default');
      expect(config.sources.sorobanRpcUrl).toBe('default');
      expect(config.sources.timeout).toBe('default');
      expect(config.sources.contractId).toBeUndefined();
    });

    it('identifies environment variable sources', () => {
      process.env.STELLAR_NETWORK = 'mainnet';
      process.env.STELLAR_TIMEOUT = '15000';
      process.env.VAULT_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      const config = resolveConfig();
      expect(config.sources.network).toBe('env');
      expect(config.sources.horizonUrl).toBe('default'); // derived from mainnet network default
      expect(config.sources.timeout).toBe('env');
      expect(config.sources.contractId).toBe('env');
    });

    it('identifies explicit override sources with highest precedence', () => {
      process.env.STELLAR_NETWORK = 'mainnet';
      process.env.STELLAR_TIMEOUT = '15000';

      const config = resolveConfig({
        network: 'testnet',
        timeout: 5000,
        horizonUrl: 'https://custom-horizon.org',
      });

      expect(config.sources.network).toBe('override');
      expect(config.sources.timeout).toBe('override');
      expect(config.sources.horizonUrl).toBe('override');
      expect(config.sources.sorobanRpcUrl).toBe('default');
    });

    it('includes config source metadata in validatePocketPayConfig output', () => {
      const result = validatePocketPayConfig({
        network: 'testnet',
      });
      expect(result.valid).toBe(true);
      expect(result.config?.sources.network).toBe('override');
      expect(result.config?.sources.horizonUrl).toBe('default');
    });
  });

  describe('Feature Flag Defaults & Resolution', () => {
    it('disables all experimental features by default', () => {
      const { flags, sources } = resolveFeatureFlags();
      expect(flags.experimentalVault).toBe(false);
      expect(flags.experimentalSorobanEvents).toBe(false);
      expect(flags.experimentalMultiAssetVault).toBe(false);
      expect(flags.experimentalAsyncSigner).toBe(false);

      for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
        expect(sources[key]).toBe('default');
      }
    });

    it('enables feature flags via POCKETPAY_FEATURE_FLAGS env variable', () => {
      process.env.POCKETPAY_FEATURE_FLAGS = 'experimentalVault, experimentalSorobanEvents';
      const { flags, sources } = resolveFeatureFlags();
      expect(flags.experimentalVault).toBe(true);
      expect(flags.experimentalSorobanEvents).toBe(true);
      expect(flags.experimentalMultiAssetVault).toBe(false);

      expect(sources.experimentalVault).toBe('env');
      expect(sources.experimentalSorobanEvents).toBe('env');
      expect(sources.experimentalMultiAssetVault).toBe('default');
    });

    it('enables feature flags via individual env variable', () => {
      process.env.POCKETPAY_FEATURE_EXPERIMENTAL_VAULT = 'true';
      const config = resolveConfig();
      expect(config.featureFlags.experimentalVault).toBe(true);
      expect(config.sources.featureFlags?.experimentalVault).toBe('env');
    });

    it('enables feature flags via explicit SDKConfig override', () => {
      const config = resolveConfig({
        featureFlags: {
          experimentalVault: true,
          customFeature: true,
        },
      });
      expect(config.featureFlags.experimentalVault).toBe(true);
      expect(config.featureFlags.customFeature).toBe(true);
      expect(config.sources.featureFlags?.experimentalVault).toBe('override');
      expect(config.sources.featureFlags?.customFeature).toBe('override');
    });
  });

  describe('Feature Flag Query & Assertion Helpers', () => {
    it('correctly queries isFeatureEnabled', () => {
      expect(isFeatureEnabled('experimentalVault')).toBe(false);
      expect(isFeatureEnabled('experimentalVault', { featureFlags: { experimentalVault: true } })).toBe(true);
    });

    it('assertFeatureEnabled succeeds when feature is enabled', () => {
      expect(() => {
        assertFeatureEnabled(
          'experimentalVault',
          { module: 'vault', operation: 'test' },
          { featureFlags: { experimentalVault: true } }
        );
      }).not.toThrow();
    });

    it('assertFeatureEnabled throws DisabledFeatureError when feature is disabled', () => {
      try {
        assertFeatureEnabled(
          'experimentalVault',
          { module: 'vault', operation: 'test' },
          { featureFlags: { experimentalVault: false } }
        );
        expect.fail('Should have thrown DisabledFeatureError');
      } catch (err) {
        expect(isDisabledFeatureError(err)).toBe(true);
        const error = err as DisabledFeatureError;
        expect(error.code).toBe(ErrorCode.SDK_FEATURE_DISABLED);
        expect(error.featureFlag).toBe('experimentalVault');
        expect(error.module).toBe('vault');
        expect(error.operation).toBe('test');
        expect(error.suggestedNextStep).toContain('Enable the feature flag');
      }
    });
  });

  describe('Diagnostics Integration', () => {
    it('includes non-sensitive config sources and feature flags in diagnostics event', () => {
      const onEvent = vi.fn();
      enableDiagnostics({ hooks: { onEvent } });

      resolveConfig({
        network: 'testnet',
        featureFlags: { experimentalVault: true },
      });

      expect(onEvent).toHaveBeenCalled();
      const event = onEvent.mock.calls[0][0];
      expect(event.domain).toBe('config');
      expect(event.type).toBe('config.resolved');
      expect(event.data.sources).toBeDefined();
      expect(event.data.featureFlags).toBeDefined();
      expect(event.data.sources.network).toBe('override');
      expect(event.data.featureFlags.experimentalVault).toBe(true);
    });

    it('includes non-sensitive sources and feature flags in buildDiagnosticsReport', () => {
      const report = buildDiagnosticsReport({
        featureFlags: { experimentalVault: true },
      });

      expect(report.config.sources).toBeDefined();
      expect(report.config.sources?.network).toBe('default');
      expect(report.config.featureFlags?.experimentalVault).toBe(true);
    });
  });

  describe('Gated Experimental Feature Paths', () => {
    it('throws DisabledFeatureError when calling executeExperimentalVaultBatch with feature disabled', async () => {
      await expect(
        executeExperimentalVaultBatch([], { featureFlags: { experimentalVault: false } })
      ).rejects.toThrow(DisabledFeatureError);
    });

    it('allows executing executeExperimentalVaultBatch when feature is enabled', async () => {
      const results = await executeExperimentalVaultBatch([], {
        featureFlags: { experimentalVault: true },
      });
      expect(results).toEqual([]);
    });

    it('throws DisabledFeatureError when calling querySorobanEvents with feature disabled', async () => {
      await expect(
        querySorobanEvents('C123', undefined, { featureFlags: { experimentalSorobanEvents: false } })
      ).rejects.toThrow(DisabledFeatureError);
    });

    it('allows executing querySorobanEvents when feature is enabled', async () => {
      const events = await querySorobanEvents('C123', 'transfer', {
        featureFlags: { experimentalSorobanEvents: true },
      });
      expect(events.length).toBe(1);
      expect(events[0].contractId).toBe('C123');
    });
  });
});
