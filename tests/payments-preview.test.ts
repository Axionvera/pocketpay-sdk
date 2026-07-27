import { describe, it, expect } from 'vitest';
import { previewPayment, createWallet, PocketPayError } from '../src';

describe('Payment Preview Helper', () => {
  it('should preview a native XLM payment correctly', async () => {
    const sender = createWallet();
    const receiver = createWallet();

    const preview = await previewPayment({
      sourceAccount: sender.publicKey,
      destination: receiver.publicKey,
      amount: '10.5',
      memo: 'Test preview',
    });

    expect(preview.sourceAccount).toBe(sender.publicKey);
    expect(preview.destination).toBe(receiver.publicKey);
    expect(preview.amount).toBe('10.5');
    expect(preview.memo).toBe('Test preview');
    expect(preview.asset.code).toBe('XLM');
    expect(preview.network).toBe('testnet');
    expect(preview.estimatedFee).toBe('100');
  });

  it('should preview an issued asset payment correctly', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    const issuer = createWallet();

    const preview = await previewPayment({
      sourceAccount: sender.publicKey,
      destination: receiver.publicKey,
      amount: '50',
      asset: { code: 'USDC', issuer: issuer.publicKey },
    }, { network: 'mainnet' });

    expect(preview.sourceAccount).toBe(sender.publicKey);
    expect(preview.destination).toBe(receiver.publicKey);
    expect(preview.amount).toBe('50');
    expect(preview.asset.code).toBe('USDC');
    expect(preview.asset.issuer).toBe(issuer.publicKey);
    expect(preview.network).toBe('mainnet');
  });

  it('should reject invalid amount', async () => {
    const sender = createWallet();
    const receiver = createWallet();

    await expect(
      previewPayment({
        sourceAccount: sender.publicKey,
        destination: receiver.publicKey,
        amount: '-5',
      })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid source account', async () => {
    const receiver = createWallet();

    await expect(
      previewPayment({
        sourceAccount: 'INVALID_PUBLIC_KEY',
        destination: receiver.publicKey,
        amount: '10',
      })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid memo length', async () => {
    const sender = createWallet();
    const receiver = createWallet();

    await expect(
      previewPayment({
        sourceAccount: sender.publicKey,
        destination: receiver.publicKey,
        amount: '10',
        memo: 'This memo text is way too long to be allowed in Stellar',
      })
    ).rejects.toThrow(PocketPayError);
  });
});
