import { defineConfig } from 'vitest/config';

/**
 * Integration test configuration.
 *
 * This suite runs ONLY `*.integration.test.ts` files and is opt-in via
 * `npm run test:integration`. These tests may make real calls to Stellar
 * Testnet (Horizon, Friendbot, Soroban RPC), so they are slower, can be
 * non-deterministic, and are never run by default or in the standard CI job.
 *
 * The offline guard used by the unit suite is intentionally NOT loaded here,
 * since these tests are allowed to reach the network.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.integration.test.ts'],
    // Real Stellar network calls can be slow, so keep generous timeouts.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});