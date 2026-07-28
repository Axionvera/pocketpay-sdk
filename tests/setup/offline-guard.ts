/**
 * Offline guard for the unit test suite.
 *
 * Loaded via `setupFiles` in `vitest.config.ts`. It replaces the global
 * `fetch` with a version that throws on any un-mocked call. Individual unit
 * tests that stub `fetch` themselves (e.g. via `vi.stubGlobal('fetch', ...)`)
 * still work, because their stub overrides this guard for the duration of the
 * test and `vi.unstubAllGlobals()` restores the guard afterwards.
 *
 * The point: if a unit test ever accidentally makes a real network request,
 * it fails loudly here instead of silently hitting the network and becoming
 * flaky. This is what enforces the "unit tests run offline" guarantee.
 */
import { beforeEach, afterEach, vi } from 'vitest';

const blockedFetch = ((): typeof fetch => {
  const guard = (input: unknown): never => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input && typeof input === 'object' && 'url' in input
            ? String((input as { url: unknown }).url)
            : String(input);

    throw new Error(
      `Blocked real network call in unit test: ${url}\n` +
        `Unit tests must be offline. Either mock fetch / the Horizon server ` +
        `for this test, or move it to a *.integration.test.ts file and run it ` +
        `with "npm run test:integration".`,
    );
  };
  return guard as unknown as typeof fetch;
})();

beforeEach(() => {
  vi.stubGlobal('fetch', blockedFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});