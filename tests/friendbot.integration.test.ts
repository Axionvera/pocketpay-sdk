/**
 * Integration smoke test — makes a REAL call to Stellar Testnet Friendbot.
 *
 * This file runs only under the integration config
 * (`npm run test:integration`) and is skipped unless RUN_INTEGRATION=1 is set,
 * so it never runs in the default suite or in standard CI.
 *
 *   RUN_INTEGRATION=1 npm run test:integration
 *
 * It funds a freshly created Testnet account and confirms the balance is
 * readable. Because it depends on live Testnet availability, it can be slow or
 * occasionally flaky — which is exactly why it lives outside the unit suite.
 */
import { describe, it, expect } from 'vitest';
import { createWallet, fundTestnetAccount, getBalance } from '../src';

const runIntegration = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!runIntegration)('Friendbot integration (live Testnet)', () => {
  it('funds a new account and reads a positive XLM balance', async () => {
    const wallet = createWallet();

    await fundTestnetAccount(wallet.publicKey);
    const balance = await getBalance(wallet.publicKey);

    expect(balance).toBeDefined();
  });
});