/**
 * Tests for the Payments module — input validation only (no network calls).
 */

import { describe, it, expect } from 'vitest';
import { sendXLM, createWallet, PocketPayError } from '../src';

describe('Payments Module — Validation', () => {
  it('should reject invalid source secret', async () => {
    await expect(
      sendXLM({
        sourceSecret: 'INVALID',
        destination: createWallet().publicKey,
        amount: '10',
      })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid destination', async () => {
    const wallet = createWallet();
    await expect(
      sendXLM({
        sourceSecret: wallet.secretKey,
        destination: 'GINVALID',
        amount: '10',
      })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject invalid amount', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    await expect(
      sendXLM({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '-5',
      })
    ).rejects.toThrow(PocketPayError);
  });

  it('should reject self-payment', async () => {
    const wallet = createWallet();
    await expect(
      sendXLM({
        sourceSecret: wallet.secretKey,
        destination: wallet.publicKey,
        amount: '10',
      })
    ).rejects.toThrow('Cannot send XLM to yourself');
  });

  it('should reject memo exceeding 28 bytes', async () => {
    const sender = createWallet();
    const receiver = createWallet();
    await expect(
      sendXLM({
        sourceSecret: sender.secretKey,
        destination: receiver.publicKey,
        amount: '10',
        memo: 'This memo is way too long and exceeds the twenty eight byte limit!',
      })
    ).rejects.toThrow('Memo text exceeds 28-byte limit');
  });
});
