/**
 * Reusable mock Horizon client for offline, deterministic SDK tests.
 *
 * Install it with installMockHorizon() in a test's setup and remove it with
 * resetHorizonServerFactory() in teardown. The returned handle exposes the
 * mock functions so each test can control loadAccount / transactions / payments
 * responses without any live network call.
 */
import { vi } from 'vitest';
import { setHorizonServerFactory, resetHorizonServerFactory } from '../../src';

export interface MockHorizonHandle {
  /** Mock for server.loadAccount(publicKey) */
  loadAccount: ReturnType<typeof vi.fn>;
  /** Mock for the terminal .call() of server.transactions()...  */
  transactionsCall: ReturnType<typeof vi.fn>;
  /** Mock for the terminal .call() of server.payments()...  */
  paymentsCall: ReturnType<typeof vi.fn>;
  /** Resets all mock call state (use in beforeEach). */
  reset(): void;
}

/**
 * Installs a mock Horizon server via the SDK's factory seam. Every SDK module
 * that calls getHorizonServer() will receive this mock until
 * resetHorizonServerFactory() is called.
 */
export function installMockHorizon(): MockHorizonHandle {
  const loadAccount = vi.fn();
  const transactionsCall = vi.fn();
  const paymentsCall = vi.fn();

  const makeChain = (callFn: ReturnType<typeof vi.fn>) => {
    const chain: any = {
      forAccount: () => chain,
      limit: () => chain,
      order: () => chain,
      cursor: () => chain,
      call: callFn,
    };
    return chain;
  };

  setHorizonServerFactory(() => ({
    loadAccount,
    transactions: () => makeChain(transactionsCall),
    payments: () => makeChain(paymentsCall),
  }) as any);

  return {
    loadAccount,
    transactionsCall,
    paymentsCall,
    reset() {
      loadAccount.mockReset();
      transactionsCall.mockReset();
      paymentsCall.mockReset();
    },
  };
}

/** Re-exported for convenient teardown. */
export { resetHorizonServerFactory };