/**
 * Tests for sendXLM preflight validation and network error mapping.
 *
 * Validation tests need no network mock — sendXLM throws before any Horizon
 * call. The account-not-found test stubs loadAccount to reject with a 404 so
 * the ACCOUNT_NOT_FOUND mapping can be exercised offline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendXLM, createWallet, PocketPayError } from '../src';
import { fundedAccount, paymentList } from './fixtures';
// ─── Mock @stellar/stellar-sdk ───────────────────────────────────────────────
// Stub Horizon.Server.loadAccount while keeping the real Keypair, Networks,
// etc. via importActual, so createWallet() and Keypair.fromSecret() still work.
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
/** Builds an HTTP-style error that Horizon SDK throws for 404 responses. */
function makeHorizon404Error(publicKey: string) {
  const err = new Error(`Account not found: ${publicKey}`) as any;
  err.response = { status: 404 };
  return err;
}
describe('Payments Module - Validation', () => {
  beforeEach(() => {
    mockLoadAccount.mockReset();
  });

  it('should reject invalid source secret', async () => {
    await expect(
      sendXLM({ sourceSecret: 'INVALID', destination: createWallet().publicKey, amount: '10' })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid destination', async () => {
    const wallet = createWallet();
    await expect(
      sendXLM({ sourceSecret: wallet.secretKey, destination: 'GINVALID', amount: '10' })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid amount', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    await expect(
      sendXLM({ sourceSecret: sender.secretKey, destination: receiver.publicKey, amount: '-5' })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject self-payment', async () => {
    const wallet = createWallet();
    await expect(
      sendXLM({ sourceSecret: wallet.secretKey, destination: wallet.publicKey, amount: '10' })
    ).rejects.toThrow('Cannot send XLM to yourself');
  });

  it('should reject memo exceeding 28 bytes', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    await expect(
      sendXLM({ sourceSecret: sender.secretKey, destination: receiver.publicKey, amount: '10', memo: 'This memo is way too long and exceeds the twenty eight byte limit!' })
    ).rejects.toThrow('Memo text exceeds 28-byte limit');
  });

  it('should not touch the network when validation fails', async () => {
    await expect(
      sendXLM({ sourceSecret: 'INVALID', destination: createWallet().publicKey, amount: '10' })
    ).rejects.toThrow(PocketPayError);
    expect(mockLoadAccount).not.toHaveBeenCalled();
  });

  it('should map an unfunded source account to ACCOUNT_NOT_FOUND', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    mockLoadAccount.mockRejectedValue(makeHorizon404Error(sender.publicKey));
    await expect(
      sendXLM({ sourceSecret: sender.secretKey, destination: receiver.publicKey, amount: '10' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });

  it('should not expose sensitive operation data in payment failure errors', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    
    // Simulate a Horizon error with result codes that might contain sensitive data
    const horizonError = new Error('Transaction failed') as any;
    horizonError.response = {
      status: 400,
      data: {
        extras: {
          result_codes: {
            transaction: 'tx_bad_seq',
            operations: ['op_bad_auth', 'op_no_source'] // This could contain sensitive details
          }
        }
      }
    };
    
    mockLoadAccount.mockRejectedValue(horizonError);
    
    await expect(
      sendXLM({ sourceSecret: sender.secretKey, destination: receiver.publicKey, amount: '10' })
    ).rejects.toThrow(PocketPayError);
    
    try {
      await sendXLM({ sourceSecret: sender.secretKey, destination: receiver.publicKey, amount: '10' });
    } catch (error) {
      expect(error).toBeInstanceOf(PocketPayError);
      const err = error as PocketPayError;
      // Error should only contain transaction code, not full operation details
      expect(err.message).toContain('tx_bad_seq');
      expect(err.message).not.toContain('op_bad_auth');
      expect(err.message).not.toContain('op_no_source');
      expect(err.message).not.toContain('JSON.stringify');
    }
  });

  describe('fixture validation', () => {
    it('fundedAccount fixture should have XLM balance', () => {
      const xlmBalance = fundedAccount.balances.find(b => b.asset_type === 'native');
      expect(xlmBalance).toBeDefined();
    });
    it('paymentList fixture should have records', () => {
      expect(paymentList._embedded.records.length).toBe(2);
    });
  });
});