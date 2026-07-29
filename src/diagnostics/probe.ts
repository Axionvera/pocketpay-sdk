/**
 * Live endpoint reachability probing for diagnostics.
 *
 * Unlike {@link buildDiagnosticsReport}, which is a pure config snapshot,
 * this module makes real network calls. It is opt-in and never included in
 * `buildDiagnosticsReport` automatically, so existing callers keep a
 * side-effect-free report by default.
 */

import { resolveConfig } from '../config';
import { checkEndpointReachability, type EndpointReachability } from '../network';
import type { SDKConfig } from '../types';

/** Reachability of the SDK's configured Horizon and Soroban RPC endpoints. */
export interface EndpointDiagnostics {
  generatedAt: string;
  horizon: EndpointReachability;
  sorobanRpc: EndpointReachability;
}

/**
 * Probes the configured Horizon and Soroban RPC endpoints and reports
 * whether each responded. Contains only URLs, timing, and typed error
 * codes — no secrets, headers, or response bodies.
 *
 * @param overrides - Optional SDK config overrides
 * @param timeoutMs - Per-endpoint probe timeout (default: 5000)
 */
export async function probeConfiguredEndpoints(
  overrides?: Partial<SDKConfig>,
  timeoutMs = 5_000,
): Promise<EndpointDiagnostics> {
  const config = resolveConfig(overrides);

  const [horizon, sorobanRpc] = await Promise.all([
    checkEndpointReachability(config.horizonUrl, timeoutMs),
    checkEndpointReachability(config.sorobanRpcUrl, timeoutMs),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    horizon,
    sorobanRpc,
  };
}
