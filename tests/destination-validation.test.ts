/**
 * Stellar PocketPay SDK — Destination Validation Tests
 *
 * Tests for destination account validation covering local and network validation,
 * malformed addresses, unfunded accounts, trustline requirements, and error cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateDestinationLocal,
  validateDestinationNetwork,
  validateDestinationComplete,
  validateDestinationOrThrow,
  safeValidateDestination,
  safeValidateDestinationLocal,
  safeValidateDestinationNetwork,
  type DestinationValidationOptions,
  type DestinationValidationResult,
  type DestinationValidationStatus,
} from '../src/payments/destination-validation';
import { PocketPayError } from '../src/types';

// Mock Stellar SDK and Horizon
vi.mock('@stellar/stellar-sdk', () => ({
  default: {
    Keypair: {
      fromSecret: vi.fn(),
    },
  },
}));

describe('Destination Validation - Local Validation', () => {
  const validPublicKey = 'GD5JQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';
  const invalidPublicKey = 'INVALID_PUBLIC_KEY';
  const anotherValidKey = 'GB7TQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';

  describe('validateDestinationLocal', () => {
    it('should validate a correct public key', () => {
      const result = validateDestinationLocal(validPublicKey);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_local');
      expect(result.localOnly).toBe(true);
      expect(result.destination).toBe(validPublicKey);
    });

    it('should reject invalid public key format', () => {
      const result = validateDestinationLocal(invalidPublicKey);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid_address_format');
      expect(result.localOnly).toBe(true);
      expect(result.errorCode).toBeDefined();
    });

    it('should detect self-payment when source is provided', () => {
      const options: DestinationValidationOptions = {
        sourcePublicKey: validPublicKey,
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('self_payment');
      expect(result.errorCode).toBe('SELF_PAYMENT');
      expect(result.localOnly).toBe(true);
    });

    it('should allow payment to different account when source is provided', () => {
      const options: DestinationValidationOptions = {
        sourcePublicKey: validPublicKey,
      };
      const result = validateDestinationLocal(anotherValidKey, options);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_local');
    });

    it('should validate native XLM asset specification', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'XLM' },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_local');
    });

    it('should validate native asset with "native" code', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'native' },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(true);
    });

    it('should reject native XLM with issuer', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'XLM', issuer: validPublicKey },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_ASSET');
    });

    it('should validate issued asset specification', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: validPublicKey },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(true);
    });

    it('should reject issued asset without issuer', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'USDC' },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_ASSET_ISSUER');
    });

    it('should reject invalid asset code format', () => {
      const options: DestinationValidationOptions = {
        asset: { code: 'TOO_LONG_ASSET_CODE', issuer: validPublicKey },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_ASSET_CODE');
    });

    it('should reject empty asset code', () => {
      const options: DestinationValidationOptions = {
        asset: { code: '', issuer: validPublicKey },
      };
      const result = validateDestinationLocal(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_ASSET_CODE');
    });
  });

  describe('safeValidateDestinationLocal', () => {
    it('should return success result for valid destination', () => {
      const result = safeValidateDestinationLocal(validPublicKey);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });

    it('should return failure result for invalid destination', () => {
      const result = safeValidateDestinationLocal(invalidPublicKey);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(PocketPayError);
      }
    });
  });
});

describe('Destination Validation - Network Validation', () => {
  const validPublicKey = 'GD5JQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';
  const unfundedPublicKey = 'GB7TQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';
  const issuerPublicKey = 'GC5TQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';

  // Mock Horizon server
  const mockLoadAccount = vi.fn();
  const mockServer = {
    loadAccount: mockLoadAccount,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock config resolution
    vi.doMock('../src/config', () => ({
      getHorizonServer: () => mockServer,
      resolveConfig: (config?: any) => ({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        timeout: 30000,
        ...config,
      }),
    }));
  });

  describe('validateDestinationNetwork - Account Existence', () => {
    it('should validate funded account', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const result = await validateDestinationNetwork(validPublicKey);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_network');
      expect(result.localOnly).toBe(false);
      expect(result.metadata?.sequence).toBe('123456789');
    });

    it('should detect unfunded account (404)', async () => {
      const error = new Error('Not Found') as any;
      error.response = { status: 404 };
      mockLoadAccount.mockRejectedValue(error);

      const result = await validateDestinationNetwork(unfundedPublicKey);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('account_not_found');
      expect(result.errorCode).toBe('UNFUNDED_DESTINATION');
      expect(result.localOnly).toBe(false);
    });

    it('should detect inactive account (zero sequence)', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '0',
        balances: [],
      });

      const result = await validateDestinationNetwork(validPublicKey);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('account_inactive');
      expect(result.errorCode).toBe('ACCOUNT_INACTIVE');
    });

    it('should detect inactive account (missing sequence)', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [],
      });

      const result = await validateDestinationNetwork(validPublicKey);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('account_inactive');
    });
  });

  describe('validateDestinationNetwork - Trustline Validation', () => {
    it('should validate native XLM without trustline check', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'XLM' },
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_network');
    });

    it('should detect missing trustline for issued asset', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [
          {
            asset_type: 'native',
            balance: '1000',
          },
        ],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: issuerPublicKey },
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('missing_trustline');
      expect(result.errorCode).toBe('MISSING_TRUSTLINE');
    });

    it('should detect unauthorized trustline', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: issuerPublicKey,
            balance: '100',
            limit: '1000',
            is_authorized: false,
            is_authorized_to_maintain_liabilities: false,
          },
        ],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: issuerPublicKey },
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('trustline_not_authorized');
      expect(result.errorCode).toBe('TRUSTLINE_NOT_AUTHORIZED');
      expect(result.metadata?.isAuthorized).toBe(false);
    });

    it('should validate authorized trustline', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: issuerPublicKey,
            balance: '100',
            limit: '1000',
            is_authorized: true,
            is_authorized_to_maintain_liabilities: true,
          },
        ],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: issuerPublicKey },
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_network');
      expect(result.metadata?.isAuthorized).toBe(true);
      expect(result.metadata?.currentBalance).toBe('100');
      expect(result.metadata?.limit).toBe('1000');
    });

    it('should detect trustline limit exceeded', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: issuerPublicKey,
            balance: '900',
            limit: '1000',
            is_authorized: true,
            is_authorized_to_maintain_liabilities: true,
          },
        ],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: issuerPublicKey },
        amount: '200', // Exceeds available capacity of 100
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('trustline_limit_exceeded');
      expect(result.errorCode).toBe('TRUSTLINE_LIMIT_EXCEEDED');
      expect(result.metadata?.availableCapacity).toBe('100.0000000');
    });

    it('should pass when amount is within trustline capacity', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: issuerPublicKey,
            balance: '100',
            limit: '1000',
            is_authorized: true,
            is_authorized_to_maintain_liabilities: true,
          },
        ],
      });

      const options: DestinationValidationOptions = {
        asset: { code: 'USDC', issuer: issuerPublicKey },
        amount: '50', // Within available capacity of 900
      };

      const result = await validateDestinationNetwork(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid_network');
    });
  });

  describe('validateDestinationNetwork - Local Validation Prerequisite', () => {
    it('should fail local validation before network call', async () => {
      const invalidKey = 'INVALID_KEY';
      
      const result = await validateDestinationNetwork(invalidKey);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid_address_format');
      expect(result.localOnly).toBe(true);
      expect(mockLoadAccount).not.toHaveBeenCalled();
    });
  });

  describe('safeValidateDestinationNetwork', () => {
    it('should return success result for valid destination', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const result = await safeValidateDestinationNetwork(validPublicKey);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });

    it('should return failure result for network error', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Network error'));

      const result = await safeValidateDestinationNetwork(validPublicKey);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(PocketPayError);
      }
    });
  });
});

describe('Destination Validation - Complete Validation', () => {
  const validPublicKey = 'GD5JQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';

  const mockLoadAccount = vi.fn();
  const mockServer = {
    loadAccount: mockLoadAccount,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.doMock('../src/config', () => ({
      getHorizonServer: () => mockServer,
      resolveConfig: (config?: any) => ({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        timeout: 30000,
        ...config,
      }),
    }));
  });

  describe('validateDestinationComplete', () => {
    it('should perform complete validation by default', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const result = await validateDestinationComplete(validPublicKey);
      expect(result.valid).toBe(true);
      expect(result.localOnly).toBe(false);
      expect(mockLoadAccount).toHaveBeenCalled();
    });

    it('should perform local-only validation when level is local', async () => {
      const options: DestinationValidationOptions = {
        level: 'local',
      };

      const result = await validateDestinationComplete(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.localOnly).toBe(true);
      expect(mockLoadAccount).not.toHaveBeenCalled();
    });

    it('should perform network validation when level is network', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const options: DestinationValidationOptions = {
        level: 'network',
      };

      const result = await validateDestinationComplete(validPublicKey, options);
      expect(result.valid).toBe(true);
      expect(result.localOnly).toBe(false);
      expect(mockLoadAccount).toHaveBeenCalled();
    });
  });

  describe('validateDestinationOrThrow', () => {
    it('should return result when validation passes', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const result = await validateDestinationOrThrow(validPublicKey);
      expect(result.valid).toBe(true);
    });

    it('should throw PocketPayError when validation fails', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const options: DestinationValidationOptions = {
        sourcePublicKey: validPublicKey,
      };

      await expect(validateDestinationOrThrow(validPublicKey, options))
        .rejects.toThrow(PocketPayError);
    });

    it('should throw with correct error code for unfunded account', async () => {
      const error = new Error('Not Found') as any;
      error.response = { status: 404 };
      mockLoadAccount.mockRejectedValue(error);

      await expect(validateDestinationOrThrow(validPublicKey))
        .rejects.toMatchObject({
          code: 'UNFUNDED_DESTINATION',
        });
    });
  });

  describe('safeValidateDestination', () => {
    it('should return success result for valid destination', async () => {
      mockLoadAccount.mockResolvedValue({
        sequence: '123456789',
        balances: [],
      });

      const result = await safeValidateDestination(validPublicKey);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });

    it('should return failure result for validation error', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Network error'));

      const result = await safeValidateDestination(validPublicKey);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(PocketPayError);
      }
    });
  });
});

describe('Destination Validation - Error Handling', () => {
  const validPublicKey = 'GD5JQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';

  it('should handle network errors gracefully', async () => {
    const mockLoadAccount = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const mockServer = { loadAccount: mockLoadAccount };

    vi.doMock('../src/config', () => ({
      getHorizonServer: () => mockServer,
      resolveConfig: () => ({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        timeout: 30000,
      }),
    }));

    await expect(validateDestinationNetwork(validPublicKey))
      .rejects.toThrow();
  });

  it('should handle timeout errors', async () => {
    const mockLoadAccount = vi.fn().mockRejectedValue(new Error('TIMEDOUT'));
    const mockServer = { loadAccount: mockLoadAccount };

    vi.doMock('../src/config', () => ({
      getHorizonServer: () => mockServer,
      resolveConfig: () => ({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        timeout: 30000,
      }),
    }));

    await expect(validateDestinationNetwork(validPublicKey))
      .rejects.toThrow();
  });
});

describe('Destination Validation - Edge Cases', () => {
  const validPublicKey = 'GD5JQ6K7LZD4NRBF7FQ4I6V7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7E7Z7';

  it('should handle case-insensitive asset codes', () => {
    const options: DestinationValidationOptions = {
      asset: { code: 'xlm' },
    };

    const result = validateDestinationLocal(validPublicKey, options);
    expect(result.valid).toBe(true);
  });

  it('should handle case-insensitive native code', () => {
    const options: DestinationValidationOptions = {
      asset: { code: 'NATIVE' },
    };

    const result = validateDestinationLocal(validPublicKey, options);
    expect(result.valid).toBe(true);
  });

  it('should handle asset code with special characters', () => {
    const options: DestinationValidationOptions = {
      asset: { code: 'USDC!', issuer: validPublicKey },
    };

    const result = validateDestinationLocal(validPublicKey, options);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ASSET_CODE');
  });

  it('should handle asset code at maximum length (12 chars)', () => {
    const options: DestinationValidationOptions = {
      asset: { code: '123456789012', issuer: validPublicKey },
    };

    const result = validateDestinationLocal(validPublicKey, options);
    expect(result.valid).toBe(true);
  });

  it('should handle asset code at minimum length (1 char)', () => {
    const options: DestinationValidationOptions = {
      asset: { code: 'A', issuer: validPublicKey },
    };

    const result = validateDestinationLocal(validPublicKey, options);
    expect(result.valid).toBe(true);
  });

  it('should handle empty options object', () => {
    const result = validateDestinationLocal(validPublicKey, {});
    expect(result.valid).toBe(true);
  });

  it('should handle undefined options', () => {
    const result = validateDestinationLocal(validPublicKey, undefined);
    expect(result.valid).toBe(true);
  });
});
