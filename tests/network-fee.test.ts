import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFeeEstimate } from '../src/network/fee';
import { getHorizonServer } from '../src/config';
import * as StellarSDK from '@stellar/stellar-sdk';

vi.mock('../src/config', async () => {
  const actual = await vi.importActual('../src/config');
  return {
    ...actual,
    getHorizonServer: vi.fn(),
  };
});

describe('Network Fee Estimation', () => {
  let mockFeeStats: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFeeStats = vi.fn();
    (getHorizonServer as vi.Mock).mockReturnValue({
      feeStats: mockFeeStats,
    });
  });

  it('should parse fee stats correctly and determine surge pricing', async () => {
    mockFeeStats.mockResolvedValue({
      last_ledger: '12345',
      last_ledger_base_fee: '100',
      ledger_capacity_usage: '0.85',
      max_fee: {
        p10: '100',
        p50: '150',
        p95: '500',
      }
    });

    const result = await fetchFeeEstimate();

    expect(result.isFallback).toBe(false);
    expect(result.surgePricing).toBe(true);
    expect(result.baseFee).toBe('100');
    expect(result.low).toBe('100');
    expect(result.standard).toBe('150');
    expect(result.high).toBe('500');
  });

  it('should identify normal network conditions', async () => {
    mockFeeStats.mockResolvedValue({
      last_ledger: '12345',
      last_ledger_base_fee: '100',
      ledger_capacity_usage: '0.40',
      max_fee: {
        p10: '100',
        p50: '100',
        p95: '200',
      }
    });

    const result = await fetchFeeEstimate();

    expect(result.isFallback).toBe(false);
    expect(result.surgePricing).toBe(false);
  });

  it('should fallback to defaults when Horizon request fails', async () => {
    mockFeeStats.mockRejectedValue(new Error('Network offline'));

    const result = await fetchFeeEstimate();

    expect(result.isFallback).toBe(true);
    expect(result.surgePricing).toBe(false);
    expect(result.baseFee).toBe(String(StellarSDK.BASE_FEE));
    expect(result.low).toBe(String(StellarSDK.BASE_FEE));
    expect(result.standard).toBe(String(StellarSDK.BASE_FEE * 2));
    expect(result.high).toBe(String(StellarSDK.BASE_FEE * 5));
  });
});
