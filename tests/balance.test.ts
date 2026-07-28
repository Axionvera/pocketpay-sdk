/**
 * Tests for getBalanceOrUnfunded and getBalance — mocked Horizon responses.
 *
 * No real network calls are made. The Horizon server's `loadAccount` method is
 * stubbed via vi.mock so tests run deterministically and offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBalance,
  getBalanceOrUnfunded,
  createWallet,
  PocketPayError,
} from '../src';

// ─── Mock @stellar/stellar-sdk ───────────────────────────────────────────────

// We mock the Horizon.Server class so `loadAccount` is controllable without
// any network connection.  The rest of the SDK (Keypair, Networks, etc.) uses
// the real implementation via `importActual`.

const mockLoadAccount = vi.fn();

vi.mock('@stellar/stellar-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
      })),
    },
  };
});

// ─── Horizon response fixtures ───────────────────────────────────────────────

/** Minimal Horizon account response with a native XLM balance. */
function makeHorizonAccount(xlmBalance = '9999.9999900') {
  return {
    balances: [
      {
        asset_type: 'native',
        balance: xlmBalance,
      },
    ],
  };
}

/** Horizon account with both native XLM and a custom asset. */
function makeHorizonAccountMultiAsset() {
  return {
    balances: [
      { asset_type: 'native', balance: '500.0000000' },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        balance: '100.0000000',
      },
    ],
  };
}

/** Builds an HTTP-style error that Horizon SDK throws for 404 responses. */
function makeHorizon404Error(publicKey: string) {
  const err = new Error(`Account not found: ${publicKey}`) as any;
  err.response = { status: 404 };
  return err;
}

/** Builds an unexpected Horizon server-side error (non-404). */
function makeHorizon500Error() {
  const err = new Error('Internal Server Error') as any;
  err.response = { status: 500 };
  return err;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getBalanceOrUnfunded', () => {
  const wallet = createWallet();

  beforeEach(() => {
    mockLoadAccount.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe('input validation', () => {
    it('should throw INVALID_PUBLIC_KEY for an invalid public key', async () => {
      await expect(getBalanceOrUnfunded('GINVALID')).rejects.toMatchObject({
        code: 'INVALID_PUBLIC_KEY',
      });
    });

    it('should throw INVALID_PUBLIC_KEY for an empty string', async () => {
      await expect(getBalanceOrUnfunded('')).rejects.toThrow(PocketPayError);
    });

    it('should throw INVALID_PUBLIC_KEY for a secret key passed as public key', async () => {
      await expect(getBalanceOrUnfunded(wallet.secretKey)).rejects.toMatchObject({
        code: 'INVALID_PUBLIC_KEY',
      });
    });

    it('should NOT call loadAccount if the public key is invalid', async () => {
      await expect(getBalanceOrUnfunded('BADKEY')).rejects.toThrow();
      expect(mockLoadAccount).not.toHaveBeenCalled();
    });
  });

  // ── Funded account ──────────────────────────────────────────────────────

  describe('funded account', () => {
    it('should return status "funded" when the account exists', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount());
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      expect(result.status).toBe('funded');
    });

    it('should include the queried publicKey in the result', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount());
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      expect(result.publicKey).toBe(wallet.publicKey);
    });

    it('should populate balance.publicKey', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount());
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      if (result.status !== 'funded') throw new Error('Expected funded');
      expect(result.balance.publicKey).toBe(wallet.publicKey);
    });

    it('should populate nativeBalance from the XLM balance entry', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount('1234.5670000'));
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      if (result.status !== 'funded') throw new Error('Expected funded');
      expect(result.balance.nativeBalance).toBe('1234.5670000');
    });

    it('should populate balances array with XLM entry', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount('9999.9999900'));
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      if (result.status !== 'funded') throw new Error('Expected funded');
      expect(result.balance.balances).toHaveLength(1);
      expect(result.balance.balances[0]).toMatchObject({
        asset: 'XLM',
        balance: '9999.9999900',
        issuer: '',
      });
    });

    it('should map multiple assets correctly', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccountMultiAsset());
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      if (result.status !== 'funded') throw new Error('Expected funded');
      expect(result.balance.balances).toHaveLength(2);
      const xlm = result.balance.balances.find((b) => b.asset === 'XLM');
      const usdc = result.balance.balances.find((b) => b.asset === 'USDC');
      expect(xlm).toBeDefined();
      expect(usdc).toMatchObject({
        asset: 'USDC',
        balance: '100.0000000',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      });
    });

    it('should not have a balance property when status is "unfunded" (type narrowing check)', async () => {
      mockLoadAccount.mockResolvedValue(makeHorizonAccount());
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      // When status is 'funded', 'balance' exists — verify via narrowing
      expect(result.status).toBe('funded');
      if (result.status === 'funded') {
        expect(result.balance).toBeDefined();
      }
    });
  });

  // ── Unfunded account ────────────────────────────────────────────────────

  describe('unfunded account (Horizon 404)', () => {
    it('should return status "unfunded" when Horizon returns 404', async () => {
      mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      expect(result.status).toBe('unfunded');
    });

    it('should include the queried publicKey in the unfunded result', async () => {
      mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      expect(result.publicKey).toBe(wallet.publicKey);
    });

    it('should NOT throw for a 404 — unfunded is a normal state', async () => {
      mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
      await expect(getBalanceOrUnfunded(wallet.publicKey)).resolves.toBeDefined();
    });

    it('should not have a balance field when status is "unfunded"', async () => {
      mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
      const result = await getBalanceOrUnfunded(wallet.publicKey);
      expect(result.status).toBe('unfunded');
      // TypeScript narrows this — verifying at runtime too
      expect((result as any).balance).toBeUndefined();
    });
  });

  // ── Unexpected Horizon failures ─────────────────────────────────────────

  describe('unexpected Horizon failures (non-404)', () => {
    it('should throw PocketPayError with BALANCE_ERROR on non-404 HTTP errors', async () => {
      mockLoadAccount.mockRejectedValue(makeHorizon500Error());
      await expect(getBalanceOrUnfunded(wallet.publicKey)).rejects.toMatchObject({
        code: 'BALANCE_ERROR',
      });
    });

    it('should throw PocketPayError with BALANCE_ERROR on network errors', async () => {
      mockLoadAccount.mockRejectedValue(new Error('fetch failed'));
      await expect(getBalanceOrUnfunded(wallet.publicKey)).rejects.toMatchObject({
        code: 'BALANCE_ERROR',
      });
    });

    it('should include the original error message in BALANCE_ERROR', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Connection refused'));
      await expect(getBalanceOrUnfunded(wallet.publicKey)).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should throw PocketPayError (not a raw Error) for unexpected failures', async () => {
      mockLoadAccount.mockRejectedValue(new Error('timeout'));
      await expect(getBalanceOrUnfunded(wallet.publicKey)).rejects.toBeInstanceOf(
        PocketPayError,
      );
    });
  });
});

// ─── getBalance — backward-compat ────────────────────────────────────────────

describe('getBalance', () => {
  const wallet = createWallet();

  beforeEach(() => {
    mockLoadAccount.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return AccountBalance for a funded account', async () => {
    mockLoadAccount.mockResolvedValue(makeHorizonAccount('500.0000000'));
    const result = await getBalance(wallet.publicKey);
    expect(result.publicKey).toBe(wallet.publicKey);
    expect(result.nativeBalance).toBe('500.0000000');
  });

  it('should throw ACCOUNT_NOT_FOUND with statusCode 404 for an unfunded account', async () => {
    mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
    await expect(getBalance(wallet.publicKey)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw BALANCE_ERROR for unexpected Horizon failures', async () => {
    mockLoadAccount.mockRejectedValue(makeHorizon500Error());
    await expect(getBalance(wallet.publicKey)).rejects.toMatchObject({
      code: 'BALANCE_ERROR',
    });
  });

  it('should throw INVALID_PUBLIC_KEY for invalid input', async () => {
    await expect(getBalance('not-a-key')).rejects.toMatchObject({
      code: 'INVALID_PUBLIC_KEY',
    });
  });

  it('error message should mention the public key for ACCOUNT_NOT_FOUND', async () => {
    mockLoadAccount.mockRejectedValue(makeHorizon404Error(wallet.publicKey));
    await expect(getBalance(wallet.publicKey)).rejects.toThrow(wallet.publicKey);
  });
});
