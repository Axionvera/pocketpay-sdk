/**
 * Tests for fundTestnetAccount — mocked Friendbot responses.
 *
 * No real network calls are made. All tests mock the global `fetch` so they
 * run deterministically and offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fundTestnetAccount, createWallet, PocketPayError } from '../src';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A realistic Friendbot success response body. */
const FRIENDBOT_SUCCESS = {
  id: 'operation-id-abc123',
  hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  ledger: 54321,
  created_at: '2024-01-15T12:00:00Z',
  fee_charged: '100',
  source_account: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGYW4TUGB8YWKEJRK7YHYB',
};

/** Builds a minimal fetch Response mock. */
function mockFetch(body: unknown, status = 200): void {
  const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
      text: async () => responseBody,
    } as Response),
  );
}

/** Builds a fetch mock that rejects with a network error. */
function mockFetchNetworkError(message = 'Network request failed'): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

function mockDelayedFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    })),
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('fundTestnetAccount', () => {
  const wallet = createWallet();

  beforeEach(() => {
    // Ensure each test starts on testnet
    process.env['STELLAR_NETWORK'] = 'testnet';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['STELLAR_NETWORK'];
  });

  // ── Success path ────────────────────────────────────────────────────────

  describe('success — full Friendbot response', () => {
    it('should return success: true', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.success).toBe(true);
    });

    it('should include the funded publicKey in the result', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.publicKey).toBe(wallet.publicKey);
    });

    it('should map hash from response', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.hash).toBe(FRIENDBOT_SUCCESS.hash);
    });

    it('should map friendbotId from response id field', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.friendbotId).toBe(FRIENDBOT_SUCCESS.id);
    });

    it('should map ledger from response', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.ledger).toBe(FRIENDBOT_SUCCESS.ledger);
    });

    it('should map createdAt from response created_at field', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.createdAt).toBe(FRIENDBOT_SUCCESS.created_at);
    });

    it('should map feeCharged from response fee_charged field', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.feeCharged).toBe(FRIENDBOT_SUCCESS.fee_charged);
    });

    it('should map friendbotAccount from response source_account field', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.friendbotAccount).toBe(FRIENDBOT_SUCCESS.source_account);
    });

    it('should not include an error field on success', async () => {
      mockFetch(FRIENDBOT_SUCCESS);
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.error).toBeUndefined();
    });
  });

  // ── Partial/minimal responses ───────────────────────────────────────────

  describe('success — partial Friendbot response (hash only)', () => {
    it('should still succeed when only hash is present', async () => {
      mockFetch({ hash: 'deadbeef', id: 'some-id' });
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.success).toBe(true);
      expect(result.hash).toBe('deadbeef');
      expect(result.friendbotId).toBe('some-id');
      expect(result.ledger).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.feeCharged).toBeUndefined();
      expect(result.friendbotAccount).toBeUndefined();
    });
  });

  describe('success — minimal Friendbot response (empty object)', () => {
    it('should succeed with all optional fields undefined', async () => {
      mockFetch({});
      const result = await fundTestnetAccount(wallet.publicKey);
      expect(result.success).toBe(true);
      expect(result.publicKey).toBe(wallet.publicKey);
      expect(result.hash).toBeUndefined();
      expect(result.friendbotId).toBeUndefined();
      expect(result.ledger).toBeUndefined();
    });
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe('input validation', () => {
    it('should throw PocketPayError with INVALID_PUBLIC_KEY for an invalid public key', async () => {
      await expect(fundTestnetAccount('GINVALID')).rejects.toThrow(PocketPayError);
      await expect(fundTestnetAccount('GINVALID')).rejects.toMatchObject({
        code: 'INVALID_PUBLIC_KEY',
      });
    });

    it('should throw for an empty string public key', async () => {
      await expect(fundTestnetAccount('')).rejects.toThrow(PocketPayError);
    });

    it('should throw for a secret key passed as public key', async () => {
      await expect(fundTestnetAccount(wallet.secretKey)).rejects.toThrow(PocketPayError);
    });
  });

  // ── Mainnet guard ───────────────────────────────────────────────────────

  describe('testnet-only guard', () => {
    it('should throw TESTNET_ONLY on mainnet without making a fetch call', async () => {
      process.env['STELLAR_NETWORK'] = 'mainnet';
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'TESTNET_ONLY',
      });
      // No network call should have been made
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── HTTP error responses ────────────────────────────────────────────────

  describe('Friendbot HTTP error responses', () => {
    it('should throw PocketPayError with FRIENDBOT_ERROR on HTTP 400', async () => {
      mockFetch('{"detail":"Account already funded"}', 400);
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'FRIENDBOT_ERROR',
        statusCode: 400,
      });
    });

    it('should throw PocketPayError with FRIENDBOT_ERROR on HTTP 404', async () => {
      mockFetch('Not Found', 404);
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'FRIENDBOT_ERROR',
        statusCode: 404,
      });
    });

    it('should throw PocketPayError with FRIENDBOT_ERROR on HTTP 500', async () => {
      mockFetch('Internal Server Error', 500);
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'FRIENDBOT_ERROR',
        statusCode: 500,
      });
    });

    it('should include the Friendbot error body in the message', async () => {
      const errorBody = 'Account already funded';
      mockFetch(errorBody, 400);
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toThrow(errorBody);
    });
  });

  // ── Network / fetch failures ────────────────────────────────────────────

  describe('network failures', () => {
    it('should throw PocketPayError with FUND_ERROR on fetch rejection', async () => {
      mockFetchNetworkError('fetch failed');
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'FUND_ERROR',
      });
    });

    it('should include the original error message in FUND_ERROR', async () => {
      mockFetchNetworkError('Connection refused');
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toThrow('Connection refused');
    });

    it('should wrap non-Error rejections into FUND_ERROR', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('some string error'));
      await expect(fundTestnetAccount(wallet.publicKey)).rejects.toMatchObject({
        code: 'FUND_ERROR',
      });
    });

    it('should throw REQUEST_TIMEOUT when Friendbot does not respond in time', async () => {
      mockDelayedFetch();

      await expect(fundTestnetAccount(wallet.publicKey, { timeout: 5 })).rejects.toMatchObject({
        code: 'REQUEST_TIMEOUT',
        message: 'Friendbot funding request timed out after 5ms',
      });
    });
  });
});
