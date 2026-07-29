/**
 * Tests for probeConfiguredEndpoints (issue #272) — live reachability
 * diagnostics for the configured Horizon and Soroban RPC endpoints.
 * All fetch calls are mocked so the suite runs offline.
 */

import { describe, it, expect, vi } from 'vitest';
import { probeConfiguredEndpoints } from '../src/diagnostics';
import { PocketPayError } from '../src/types';

function mockFetchOk(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    } as Response),
  );
}

describe('probeConfiguredEndpoints', () => {
  it('reports both configured endpoints as reachable', async () => {
    mockFetchOk();
    const report = await probeConfiguredEndpoints({ network: 'testnet' });

    expect(report.horizon.reachable).toBe(true);
    expect(report.sorobanRpc.reachable).toBe(true);
    expect(report.horizon.url).toContain('horizon-testnet.stellar.org');
    expect(report.sorobanRpc.url).toContain('soroban-testnet.stellar.org');
  });

  it('rejects malformed config before making any network calls', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      probeConfiguredEndpoints({ network: 'not-a-real-network' as any }),
    ).rejects.toBeInstanceOf(PocketPayError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never includes secrets or response bodies in the report', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ secretKey: 'SSHOULDNEVERAPPEAR' }),
        text: async () => '{"secretKey":"SSHOULDNEVERAPPEAR"}',
      } as Response),
    );

    const report = await probeConfiguredEndpoints({ network: 'testnet' });
    expect(JSON.stringify(report)).not.toContain('SSHOULDNEVERAPPEAR');
  });
});
