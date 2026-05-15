/**
 * Stellar PocketPay SDK — Network Configuration
 *
 * Resolves Horizon and Soroban RPC endpoints based on the selected network.
 * Defaults to Stellar Testnet. Override via environment variables or programmatic config.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { SDKConfig, StellarNetwork } from '../types';

// ─── Default URLs ───────────────────────────────────────────────────────────

const HORIZON_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

const SOROBAN_RPC_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
};

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  testnet: StellarSDK.Networks.TESTNET,
  mainnet: StellarSDK.Networks.PUBLIC,
};

const FRIENDBOT_URL = 'https://friendbot.stellar.org';

// ─── Resolve Config ─────────────────────────────────────────────────────────

/**
 * Resolves the SDK configuration by merging environment variables with defaults.
 *
 * Priority: explicit param > env var > default (testnet)
 *
 * @param overrides - Optional partial config to override defaults
 * @returns Fully resolved SDK configuration
 */
export function resolveConfig(overrides?: Partial<SDKConfig>): SDKConfig {
  const network: StellarNetwork =
    overrides?.network ??
    (process.env.STELLAR_NETWORK as StellarNetwork) ??
    'testnet';

  const horizonUrl =
    overrides?.horizonUrl ||
    process.env.STELLAR_HORIZON_URL ||
    HORIZON_URLS[network];

  const sorobanRpcUrl =
    overrides?.sorobanRpcUrl ||
    process.env.STELLAR_SOROBAN_RPC_URL ||
    SOROBAN_RPC_URLS[network];

  return { network, horizonUrl, sorobanRpcUrl };
}

/**
 * Creates a configured Horizon server instance.
 *
 * @param config - Optional SDK config (resolved automatically if omitted)
 * @returns Horizon.Server instance
 */
export function getHorizonServer(
  config?: Partial<SDKConfig>
): StellarSDK.Horizon.Server {
  const resolved = resolveConfig(config);
  return new StellarSDK.Horizon.Server(resolved.horizonUrl);
}

/**
 * Returns the network passphrase for the configured network.
 *
 * @param network - Target network (default: resolved from config)
 * @returns Network passphrase string
 */
export function getNetworkPassphrase(network?: StellarNetwork): string {
  const resolvedNetwork = network ?? resolveConfig().network;
  return NETWORK_PASSPHRASES[resolvedNetwork];
}

/**
 * Returns the Friendbot URL for testnet funding.
 *
 * @returns Friendbot URL string
 */
export function getFriendbotUrl(): string {
  return FRIENDBOT_URL;
}

export { HORIZON_URLS, SOROBAN_RPC_URLS, NETWORK_PASSPHRASES };
