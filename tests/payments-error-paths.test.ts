/**
 * Error-path tests for SDK payment helpers (issue #373).
 *
 * Exercises invalid destination, amount, asset, memo, and network/submission
 * failure modes for sendXLM and sendAsset with typed PocketPayError assertions.
 * All tests run offline — Horizon is mocked and no live network is used.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendXLM,
  sendAsset,
  safeSendAsset,
  createWallet,
  PocketPayError,
} from '../src';
import {
  makeHorizon404Error,
  makeHorizonResultCodeError,
  neverSettlingPromise,
} from './fixtures';

const mockLoadAccount = vi.fn();
const mockSubmitTransaction = vi.fn();

vi.mock('@stellar/stellar-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
      })),
    },
  };
});

async function expectPocketPayError(
  promise: Promise<unknown>,
  expected: { code: string; validation?: Record<string, unknown>; timeout?: { stage: string } },
) {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(PocketPayError);
    expect(error).toMatchObject(expected);
  }
}

async function sourceAccountFor(publicKey: string, sequence = '100') {
  const { Account } = await import('@stellar/stellar-sdk');
  return new Account(publicKey, sequence);
}

function validUsdcTrustline(issuer: string) {
  return {
    balances: [
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: issuer,
        balance: '100.0000000',
        limit: '1000.0000000',
        is_authorized: true,
      },
    ],
  };
}

describe('sendXLM — typed validation errors', () => {
  beforeEach(() => {
    mockLoadAccount.mockReset();
    mockSubmitTransaction.mockReset();
  });

  it.each([
    {
      name: 'invalid source secret',
      params: () => ({
        sourceSecret: 'NOT_A_SECRET',
        destination: createWallet().publicKey,
        amount: '10',
      }),
      code: 'INVALID_SECRET_KEY',
      validation: { field: 'secretKey', reason: 'invalid_prefix' },
    },
    {
      name: 'invalid destination public key',
      params: () => {
        const sender = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: 'GINVALID',
          amount: '10',
        };
      },
      code: 'INVALID_PUBLIC_KEY',
      validation: { field: 'publicKey', reason: 'invalid_format' },
    },
    {
      name: 'negative amount',
      params: () => {
        const sender = createWallet();
        const receiver = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '-5',
        };
      },
      code: 'INVALID_AMOUNT',
      validation: { field: 'amount', reason: 'invalid_format' },
    },
    {
      name: 'zero amount',
      params: () => {
        const sender = createWallet();
        const receiver = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '0',
        };
      },
      code: 'INVALID_AMOUNT',
      validation: { field: 'amount', reason: 'not_positive' },
    },
    {
      name: 'non-numeric amount',
      params: () => {
        const sender = createWallet();
        const receiver = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '10abc',
        };
      },
      code: 'INVALID_AMOUNT',
      validation: { field: 'amount', reason: 'invalid_format' },
    },
    {
      name: 'amount with too many decimal places',
      params: () => {
        const sender = createWallet();
        const receiver = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '1.12345678',
        };
      },
      code: 'INVALID_AMOUNT_PRECISION',
      validation: { field: 'amount', reason: 'too_precise' },
    },
    {
      name: 'memo exceeding 28 bytes',
      params: () => {
        const sender = createWallet();
        const receiver = createWallet();
        return {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '10',
          memo: 'a'.repeat(29),
        };
      },
      code: 'TX_INVALID_MEMO',
      validation: { field: 'memo', reason: 'too_long' },
    },
    {
      name: 'self-payment',
      params: () => {
        const wallet = createWallet();
        return {
          sourceSecret: wallet.secretKey,
          destination: wallet.publicKey,
          amount: '10',
        };
      },
      code: 'SELF_PAYMENT',
      validation: { field: 'destination', reason: 'same_as_source' },
    },
  ])('$name', async ({ params, code, validation }) => {
    await expectPocketPayError(sendXLM(params()), { code, validation });
    expect(mockLoadAccount).not.toHaveBeenCalled();
  });
});

describe('sendXLM — network and submission errors', () => {
  let sender: ReturnType<typeof createWallet>;
  let receiver: ReturnType<typeof createWallet>;

  beforeEach(() => {
    mockLoadAccount.mockReset();
    mockSubmitTransaction.mockReset();
    sender = createWallet();
    receiver = createWallet();
  });

  it('returns success with transaction hash on a valid submission', async () => {
    mockSubmitTransaction.mockResolvedValueOnce({
      hash: 'XLM_SUCCESS_HASH',
      ledger: 42,
      fee_charged: '100',
      created_at: '2026-07-22T12:00:00Z',
    });
    mockLoadAccount.mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));

    const result = await sendXLM({
      sourceSecret: sender.secretKey,
      destination: receiver.publicKey,
      amount: '10',
    });

    expect(result.success).toBe(true);
    expect(result.hash).toBe('XLM_SUCCESS_HASH');
    expect(result.destinationAccount).toBe(receiver.publicKey);
  });

  it('maps an unfunded source account to ACCOUNT_NOT_FOUND', async () => {
    mockLoadAccount.mockRejectedValue(makeHorizon404Error(sender.publicKey));

    await expectPocketPayError(
      sendXLM({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
      }),
      { code: 'ACCOUNT_NOT_FOUND' },
    );
  });

  it('maps a slow source account lookup to REQUEST_TIMEOUT (preparation stage)', async () => {
    mockLoadAccount.mockReturnValue(neverSettlingPromise());

    await expectPocketPayError(
      sendXLM(
        {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '10',
        },
        { timeout: 5 },
      ),
      {
        code: 'REQUEST_TIMEOUT',
        timeout: { stage: 'preparation' },
      },
    );
  });

  it('maps a slow submission to TX_STATUS_UNKNOWN (submission stage)', async () => {
    mockLoadAccount.mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));
    mockSubmitTransaction.mockReturnValue(neverSettlingPromise());

    await expectPocketPayError(
      sendXLM(
        {
          sourceSecret: sender.secretKey,
          destination: receiver.publicKey,
          amount: '10',
        },
        { timeout: 5 },
      ),
      {
        code: 'TX_STATUS_UNKNOWN',
        timeout: { stage: 'submission' },
      },
    );
  });

  it('maps Horizon result codes on submission to PAYMENT_FAILED', async () => {
    mockLoadAccount.mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));
    mockSubmitTransaction.mockRejectedValue(
      makeHorizonResultCodeError('tx_insufficient_balance', ['op_underfunded']),
    );

    try {
      await sendXLM({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
      });
      throw new Error('expected sendXLM to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PocketPayError);
      const err = error as PocketPayError;
      expect(err.code).toBe('PAYMENT_FAILED');
      expect(err.message).toContain('tx_insufficient_balance');
      expect(err.message).not.toContain('op_underfunded');
    }
  });

  it('wraps unexpected submission failures as SEND_ERROR', async () => {
    mockLoadAccount.mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));
    mockSubmitTransaction.mockRejectedValue(new Error('Network failure'));

    await expectPocketPayError(
      sendXLM({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
      }),
      { code: 'SEND_ERROR' },
    );
  });
});

describe('sendAsset — typed validation errors', () => {
  let sender: ReturnType<typeof createWallet>;
  let receiver: ReturnType<typeof createWallet>;
  let issuer: ReturnType<typeof createWallet>;

  beforeEach(() => {
    mockLoadAccount.mockReset();
    mockSubmitTransaction.mockReset();
    sender = createWallet();
    receiver = createWallet();
    issuer = createWallet();
  });

  it.each([
    {
      name: 'invalid destination',
      build: (ctx: { issuer: ReturnType<typeof createWallet>; receiver: ReturnType<typeof createWallet> }) => ({
        destination: 'GBADKEY',
        amount: '10',
        asset: { code: 'USDC', issuer: ctx.issuer.publicKey },
      }),
      code: 'INVALID_PUBLIC_KEY',
      validation: { field: 'publicKey', reason: 'invalid_format' },
    },
    {
      name: 'zero amount',
      build: (ctx: { issuer: ReturnType<typeof createWallet>; receiver: ReturnType<typeof createWallet> }) => ({
        destination: ctx.receiver.publicKey,
        amount: '0',
        asset: { code: 'USDC', issuer: ctx.issuer.publicKey },
      }),
      code: 'INVALID_AMOUNT',
      validation: { field: 'amount', reason: 'not_positive' },
    },
    {
      name: 'non-numeric amount',
      build: (ctx: { issuer: ReturnType<typeof createWallet>; receiver: ReturnType<typeof createWallet> }) => ({
        destination: ctx.receiver.publicKey,
        amount: '5.5.5',
        asset: { code: 'USDC', issuer: ctx.issuer.publicKey },
      }),
      code: 'INVALID_AMOUNT',
      validation: { field: 'amount', reason: 'invalid_format' },
    },
    {
      name: 'amount with too many decimal places',
      build: (ctx: { issuer: ReturnType<typeof createWallet>; receiver: ReturnType<typeof createWallet> }) => ({
        destination: ctx.receiver.publicKey,
        amount: '1.12345678',
        asset: { code: 'USDC', issuer: ctx.issuer.publicKey },
      }),
      code: 'INVALID_AMOUNT_PRECISION',
      validation: { field: 'amount', reason: 'too_precise' },
    },
  ])('$name', async ({ build, code, validation }) => {
    const built = build({ issuer, receiver });
    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        ...built,
      }),
      { code, validation },
    );
    expect(mockLoadAccount).not.toHaveBeenCalled();
  });
});

describe('sendAsset — unsupported asset errors', () => {
  let sender: ReturnType<typeof createWallet>;
  let receiver: ReturnType<typeof createWallet>;
  let issuer: ReturnType<typeof createWallet>;

  beforeEach(() => {
    mockLoadAccount.mockReset();
    sender = createWallet();
    receiver = createWallet();
    issuer = createWallet();
  });

  it.each([
    {
      name: 'native XLM with spurious issuer',
      buildAsset: (issuer: ReturnType<typeof createWallet>) => ({ code: 'XLM', issuer: issuer.publicKey }),
      code: 'INVALID_ASSET',
      validation: { field: 'asset.issuer', reason: 'native_asset_has_issuer' },
    },
    {
      name: 'asset code too long',
      buildAsset: (issuer: ReturnType<typeof createWallet>) => ({ code: 'TOOLONGCODE123', issuer: issuer.publicKey }),
      code: 'INVALID_ASSET_CODE',
      validation: { field: 'asset.code', reason: 'invalid_format' },
    },
    {
      name: 'issued asset missing issuer',
      buildAsset: () => ({ code: 'USDC' }),
      code: 'MISSING_ASSET_ISSUER',
      validation: { field: 'asset.issuer', reason: 'missing' },
    },
    {
      name: 'issued asset with invalid issuer key',
      buildAsset: () => ({ code: 'USDC', issuer: 'NOTAVALIDKEY' }),
      code: 'INVALID_PUBLIC_KEY',
      validation: { field: 'publicKey', reason: 'invalid_format' },
    },
    {
      name: 'empty asset code',
      buildAsset: () => ({ code: '' }) as any,
      code: 'INVALID_ASSET_CODE',
      validation: { field: 'asset.code', reason: 'empty' },
    },
  ])('$name', async ({ buildAsset, code, validation }) => {
    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: buildAsset(issuer),
      }),
      { code, validation },
    );
    expect(mockLoadAccount).not.toHaveBeenCalled();
  });
});

describe('sendAsset — destination trustline errors', () => {
  let sender: ReturnType<typeof createWallet>;
  let receiver: ReturnType<typeof createWallet>;
  let issuer: ReturnType<typeof createWallet>;

  beforeEach(() => {
    mockLoadAccount.mockReset();
    sender = createWallet();
    receiver = createWallet();
    issuer = createWallet();
  });

  it('throws UNFUNDED_DESTINATION when destination account does not exist', async () => {
    mockLoadAccount.mockRejectedValue(makeHorizon404Error(receiver.publicKey));

    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      }),
      {
        code: 'UNFUNDED_DESTINATION',
        validation: { field: 'destination', reason: 'account_not_found' },
      },
    );
  });

  it('throws MISSING_TRUSTLINE when destination has no matching balance', async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '100.0' }],
    });

    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      }),
      {
        code: 'MISSING_TRUSTLINE',
        validation: { field: 'destination', reason: 'missing_trustline' },
      },
    );
  });

  it('throws TRUSTLINE_NOT_AUTHORIZED when trustline is not authorized', async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: issuer.publicKey,
          balance: '0.0000000',
          limit: '1000.0000000',
          is_authorized: false,
        },
      ],
    });

    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      }),
      {
        code: 'TRUSTLINE_NOT_AUTHORIZED',
        validation: { field: 'destination', reason: 'not_authorized' },
      },
    );
  });

  it('throws TRUSTLINE_LIMIT_EXCEEDED when payment exceeds available capacity', async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: issuer.publicKey,
          balance: '950.0000000',
          limit: '1000.0000000',
          is_authorized: true,
        },
      ],
    });

    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '100',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      }),
      {
        code: 'TRUSTLINE_LIMIT_EXCEEDED',
        validation: { field: 'destination', reason: 'limit_exceeded' },
      },
    );
  });
});

describe('sendAsset — network and submission errors', () => {
  let sender: ReturnType<typeof createWallet>;
  let receiver: ReturnType<typeof createWallet>;
  let issuer: ReturnType<typeof createWallet>;

  beforeEach(() => {
    mockLoadAccount.mockReset();
    mockSubmitTransaction.mockReset();
    sender = createWallet();
    receiver = createWallet();
    issuer = createWallet();
  });

  it('maps Horizon result codes on submission to PAYMENT_FAILED', async () => {
    mockLoadAccount
      .mockResolvedValueOnce(validUsdcTrustline(issuer.publicKey))
      .mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));
    mockSubmitTransaction.mockRejectedValue(
      makeHorizonResultCodeError('tx_failed', ['op_no_trust']),
    );

    try {
      await sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      });
      throw new Error('expected sendAsset to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PocketPayError);
      const err = error as PocketPayError;
      expect(err.code).toBe('PAYMENT_FAILED');
      expect(err.message).toContain('tx_failed');
      expect(err.message).not.toContain('op_no_trust');
    }
  });

  it('wraps unexpected submission failures as SEND_ERROR', async () => {
    mockLoadAccount
      .mockResolvedValueOnce(validUsdcTrustline(issuer.publicKey))
      .mockResolvedValueOnce(await sourceAccountFor(sender.publicKey));
    mockSubmitTransaction.mockRejectedValue(new Error('Connection reset'));

    await expectPocketPayError(
      sendAsset({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        asset: { code: 'USDC', issuer: issuer.publicKey },
      }),
      { code: 'SEND_ERROR' },
    );
  });

  it('safeSendAsset returns typed SEND_ERROR without throwing on network failure', async () => {
    mockLoadAccount.mockRejectedValue(new Error('Network failure'));

    const result = await safeSendAsset({
      sourceSecret: sender.secretKey,
      destination: receiver.publicKey,
      amount: '10',
      asset: { code: 'USDC', issuer: issuer.publicKey },
      skipTrustlineCheck: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('SEND_ERROR');
    }
  });
});
