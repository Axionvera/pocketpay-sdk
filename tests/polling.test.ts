import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollTransaction } from '../src/transactions/polling';
import * as configModule from '../src/config';

describe('pollTransaction', () => {
  const MOCK_HASH = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success when transaction is confirmed successfully', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      hash: MOCK_HASH,
      ledger: 100,
      created_at: '2023-01-01T00:00:00Z',
      source_account: 'GABC',
      fee_charged: '100',
      operation_count: 1,
      successful: true,
      memo: 'hello',
      memo_type: 'text',
    });

    const mockServer = {
      transactions: () => ({
        transaction: (hash: string) => ({
          call: mockCall,
        }),
      }),
    };

    vi.spyOn(configModule, 'getHorizonServer').mockReturnValue(mockServer as any);

    const result = await pollTransaction(MOCK_HASH, { interval: 10, timeout: 500 });
    
    expect(result.status).toBe('success');
    expect(result.hash).toBe(MOCK_HASH);
    expect(result.transaction?.successful).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('returns failure when transaction is confirmed as failed', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      hash: MOCK_HASH,
      ledger: 101,
      created_at: '2023-01-01T00:00:00Z',
      source_account: 'GABC',
      fee_charged: '100',
      operation_count: 1,
      successful: false,
    });

    const mockServer = {
      transactions: () => ({
        transaction: (hash: string) => ({
          call: mockCall,
        }),
      }),
    };

    vi.spyOn(configModule, 'getHorizonServer').mockReturnValue(mockServer as any);

    const result = await pollTransaction(MOCK_HASH, { interval: 10, timeout: 500 });
    
    expect(result.status).toBe('failure');
    expect(result.hash).toBe(MOCK_HASH);
    expect(result.transaction?.successful).toBe(false);
  });

  it('retries on 404 until success', async () => {
    const mockCall = vi.fn()
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        hash: MOCK_HASH,
        successful: true,
      });

    const mockServer = {
      transactions: () => ({
        transaction: (hash: string) => ({
          call: mockCall,
        }),
      }),
    };

    vi.spyOn(configModule, 'getHorizonServer').mockReturnValue(mockServer as any);

    const result = await pollTransaction(MOCK_HASH, { interval: 10, timeout: 500 });
    
    expect(result.status).toBe('success');
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it('returns timeout when time expires', async () => {
    const mockCall = vi.fn().mockRejectedValue({ response: { status: 404 } });

    const mockServer = {
      transactions: () => ({
        transaction: (hash: string) => ({
          call: mockCall,
        }),
      }),
    };

    vi.spyOn(configModule, 'getHorizonServer').mockReturnValue(mockServer as any);

    const result = await pollTransaction(MOCK_HASH, { interval: 10, timeout: 50 });
    
    expect(result.status).toBe('timeout');
    expect(result.error).toMatch(/timed out/);
    expect(mockCall.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('returns unknown state for non-network errors', async () => {
    const mockCall = vi.fn().mockRejectedValue({ status: 400, message: 'Bad request' });

    const mockServer = {
      transactions: () => ({
        transaction: (hash: string) => ({
          call: mockCall,
        }),
      }),
    };

    vi.spyOn(configModule, 'getHorizonServer').mockReturnValue(mockServer as any);

    const result = await pollTransaction(MOCK_HASH, { interval: 10, timeout: 500 });
    
    expect(result.status).toBe('unknown');
    expect(result.error).toMatch(/Bad request/i);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });
});
