/**
 * Tests for the Config module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig, getNetworkPassphrase, getFriendbotUrl } from '../src';

describe('Config Module', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  describe('resolveConfig', () => {
    it('should default to testnet', () => {
      delete process.env.STELLAR_NETWORK;
      const config = resolveConfig();
      expect(config.network).toBe('testnet');
      expect(config.horizonUrl).toContain('testnet');
      expect(config.sorobanRpcUrl).toContain('testnet');
    });

    it('should respect environment variables', () => {
      process.env.STELLAR_NETWORK = 'mainnet';
      const config = resolveConfig();
      expect(config.network).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
    });

    it('should allow programmatic overrides', () => {
      const config = resolveConfig({
        network: 'mainnet',
        horizonUrl: 'https://custom-horizon.example.com',
      });
      expect(config.network).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://custom-horizon.example.com');
    });

    it('should prioritize overrides over env vars', () => {
      process.env.STELLAR_NETWORK = 'mainnet';
      const config = resolveConfig({ network: 'testnet' });
      expect(config.network).toBe('testnet');
    });
  });

  describe('getNetworkPassphrase', () => {
    it('should return testnet passphrase by default', () => {
      const passphrase = getNetworkPassphrase('testnet');
      expect(passphrase).toContain('Test SDF Network');
    });

    it('should return mainnet passphrase', () => {
      const passphrase = getNetworkPassphrase('mainnet');
      expect(passphrase).toContain('Public Global Stellar Network');
    });
  });

  describe('getFriendbotUrl', () => {
    it('should return the friendbot URL', () => {
      const url = getFriendbotUrl();
      expect(url).toBe('https://friendbot.stellar.org');
    });
  });
});
