/**
 * Demonstrates the mockable Horizon seam (#12): SDK modules use a real Horizon
 * server by default, and a mock during tests via setHorizonServerFactory.
 *
 * These tests exercise getBalance through the public API with an injected mock
 * Horizon client — no vi.mock, no live network — proving the seam works.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBalance, createWallet } from '../src';
import { installMockHorizon, resetHorizonServerFactory, MockHorizonHandle } from './helpers/mockHorizon';

describe('Mockable Horizon seam (#12)', () => {
  const wallet = createWallet();
  let horizon: MockHorizonHandle;

  beforeEach(() => {
    horizon = installMockHorizon();
    horizon.reset();
  });

  afterEach(() => {
    resetHorizonServerFactory();
  });

  it('routes getBalance through the injected mock Horizon (offline)', async () => {
    horizon.loadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '250.0000000' }],
    });
    const result = await getBalance(wallet.publicKey);
    expect(result.nativeBalance).toBe('250.0000000');
    expect(horizon.loadAccount).toHaveBeenCalledTimes(1);
  });

  it('surfaces an injected 404 as ACCOUNT_NOT_FOUND', async () => {
    const err = new Error('not found') as any;
    err.response = { status: 404 };
    horizon.loadAccount.mockRejectedValue(err);
    await expect(getBalance(wallet.publicKey)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('surfaces slow Horizon account lookups as REQUEST_TIMEOUT', async () => {
    horizon.loadAccount.mockReturnValue(new Promise(() => undefined));

    await expect(getBalance(wallet.publicKey, { timeout: 5 })).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      message: 'Horizon account lookup timed out after 5ms',
    });
  });

  it('is deterministic — no live network dependency', async () => {
    horizon.loadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '1.0000000' }],
    });
    const a = await getBalance(wallet.publicKey);
    const b = await getBalance(wallet.publicKey);
    expect(a.nativeBalance).toBe(b.nativeBalance);
  });
});
