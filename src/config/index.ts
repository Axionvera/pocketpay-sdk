/**
 * Stellar PocketPay SDK — Network Configuration
 *
 * Resolves Horizon and Soroban RPC endpoints based on the selected network.
 * Defaults to Stellar Testnet. Override via environment variables or programmatic config.
 */
import * as StellarSDK from '@stellar/stellar-sdk';
import { SDKConfig, StellarNetwork } from '../types';
import { PocketPayError } from '../types';
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
// ─── Validation ─────────────────────────────────────────────────────────────
/**
 * Validates that a network name is supported.
 *
 * @param network - The network name to validate
 * @throws PocketPayError if network is not 'testnet' or 'mainnet'
 */
export function validateNetwork(network: unknown): asserts network is StellarNetwork {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new PocketPayError(
      `Unsupported network: "${network}". Supported networks: testnet, mainnet`,
      'INVALID_NETWORK'
    );
  }
}
/**
 * Validates that a URL string is a valid HTTP(S) URL.
 *
 * @param url - The URL to validate
 * @param fieldName - Human-readable field name (for error messages)
 * @param errorCode - Machine-readable error code to attach on failure
 * @throws PocketPayError if URL is invalid
 */
export function validateUrl(url: string, fieldName: string, errorCode: string): void {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('Protocol must be http or https');
    }
  } catch (error) {
    throw new PocketPayError(
      `Invalid ${fieldName}: "${url}". Must be a valid HTTP(S) URL.`,
      errorCode
    );
  }
}
/**
 * Validates Horizon URL format.
 *
 * @param url - The URL to validate
 * @throws PocketPayError if URL is invalid
 */
export function validateHorizonUrl(url: string): void {
  validateUrl(url, 'Horizon URL', 'INVALID_HORIZON_URL');
}
/**
 * Validates Soroban RPC URL format.
 *
 * @param url - The URL to validate
 * @throws PocketPayError if URL is invalid
 */
export function validateSorobanRpcUrl(url: string): void {
  validateUrl(url, 'Soroban RPC URL', 'INVALID_SOROBAN_RPC_URL');
}
/**
 * Validates timeout value.
 *
 * @param timeout - The timeout value to validate (in milliseconds)
 * @throws PocketPayError if timeout is invalid
 */
export function validateTimeout(timeout: unknown): asserts timeout is number {
  if (typeof timeout !== 'number') {
    throw new PocketPayError(
      `Invalid timeout: "${timeout}". Timeout must be a number (milliseconds).`,
      'INVALID_TIMEOUT'
    );
  }
  if (timeout <= 0) {
    throw new PocketPayError(
      `Invalid timeout: ${timeout}. Timeout must be greater than 0.`,
      'INVALID_TIMEOUT'
    );
  }
  if (!Number.isFinite(timeout)) {
    throw new PocketPayError(
      `Invalid timeout: ${timeout}. Timeout must be a finite number.`,
      'INVALID_TIMEOUT'
    );
  }
}
/**
 * Validates Soroban contract ID format.
 * Contract IDs are 56-character base32-encoded strings starting with 'C'.
 *
 * @param contractId - The contract ID to validate
 * @throws PocketPayError if contract ID is invalid
 */
export function validateContractId(contractId: string): void {
  if (typeof contractId !== 'string' || contractId.length === 0) {
    throw new PocketPayError(
      `Invalid contract ID: "${contractId}". Contract ID must be a non-empty string.`,
      'INVALID_CONTRACT_ID'
    );
  }
  if (!contractId.startsWith('C') || contractId.length !== 56) {
    throw new PocketPayError(
      `Invalid contract ID: "${contractId}". Contract ID must be a 56-character base32 string starting with 'C'.`,
      'INVALID_CONTRACT_ID'
    );
  }
  // Validate base32 characters (base32 uses A-Z and 2-7)
  if (!/^C[A-Z2-7]{55}$/.test(contractId)) {
    throw new PocketPayError(
      `Invalid contract ID format: "${contractId}". Contract ID must contain only base32 characters (A-Z, 2-7).`,
      'INVALID_CONTRACT_ID'
    );
  }
}
// ─── Resolve Config ─────────────────────────────────────────────────────────
/**
 * Resolves the SDK configuration by merging environment variables with defaults.
 *
 * Priority: explicit param > env var > default (testnet)
 * All configuration values are validated before returning. Values passed
 * explicitly in `overrides` are validated as-is: an explicit `null`, empty
 * string, or other invalid value is rejected rather than silently replaced
 * by a default.
 *
 * @param overrides - Optional partial config to override defaults
 * @returns Fully resolved and validated SDK configuration
 * @throws PocketPayError if any configuration value is invalid
 */
export function resolveConfig(overrides?: Partial<SDKConfig>): SDKConfig {
  // Network: an explicitly-provided value (including null) must be validated
  // as-is; only undefined falls through to env var, then the testnet default.
  const network: unknown =
    overrides?.network !== undefined
      ? overrides.network
      : process.env.STELLAR_NETWORK ?? 'testnet';
  validateNetwork(network);

  // Horizon URL: an explicitly-provided value (including '') is validated
  // as-is; only undefined falls through to env var, then the network default.
  const horizonUrl =
    overrides?.horizonUrl !== undefined
      ? overrides.horizonUrl
      : process.env.STELLAR_HORIZON_URL ?? HORIZON_URLS[network];
  validateHorizonUrl(horizonUrl);

  // Soroban RPC URL: same explicit-value semantics as Horizon URL.
  const sorobanRpcUrl =
    overrides?.sorobanRpcUrl !== undefined
      ? overrides.sorobanRpcUrl
      : process.env.STELLAR_SOROBAN_RPC_URL ?? SOROBAN_RPC_URLS[network];
  validateSorobanRpcUrl(sorobanRpcUrl);

  // Timeout: validate only when provided.
  const timeout =
    overrides?.timeout ??
    (process.env.STELLAR_TIMEOUT
      ? parseInt(process.env.STELLAR_TIMEOUT, 10)
      : undefined);
  if (timeout !== undefined) {
    validateTimeout(timeout);
  }

  // Contract ID: preserve an explicitly-provided value (including '').
  // An empty string is a valid "no contract configured" sentinel and is
  // passed through unvalidated; a non-empty value is validated.
  const contractId =
    overrides?.contractId !== undefined
      ? overrides.contractId
      : process.env.STELLAR_CONTRACT_ID;
  if (contractId !== undefined && contractId.length > 0) {
    validateContractId(contractId);
  }

  return { network, horizonUrl, sorobanRpcUrl, timeout, contractId };
}
/**
 * Creates a configured Horizon server instance.
 *
 * @param config - Optional SDK config (resolved automatically if omitted)
 * @returns Horizon.Server instance
 * @throws PocketPayError if configuration is invalid
 */
export function getHorizonServer(
  config?: Partial<SDKConfig>
): StellarSDK.Horizon.Server {
  const resolved = resolveConfig(config);
  return new StellarSDK.Horizon.Server(resolved.horizonUrl);
}

/**
 * Returns the resolved Soroban RPC URL for the given (or ambient) config.
 *
 * Resolution follows the same precedence as {@link resolveConfig}:
 * explicit override > STELLAR_SOROBAN_RPC_URL env var > network default.
 *
 * @param config - Optional SDK config (resolved automatically if omitted)
 * @returns The resolved Soroban RPC URL
 * @throws PocketPayError if configuration is invalid
 */
export function getSorobanRpcUrl(config?: Partial<SDKConfig>): string {
  return resolveConfig(config).sorobanRpcUrl;
}
/**
 * Returns the network passphrase for the configured network.
 *
 * @param network - Target network (default: resolved from config)
 * @returns Network passphrase string
 * @throws PocketPayError if network is unsupported
 */
export function getNetworkPassphrase(network?: StellarNetwork): string {
  const resolvedNetwork = network ?? resolveConfig().network;
  validateNetwork(resolvedNetwork);
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
export {
  HORIZON_URLS,
  SOROBAN_RPC_URLS,
  NETWORK_PASSPHRASES,
};