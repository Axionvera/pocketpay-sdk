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
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws PocketPayError if URL is invalid
 */
export function validateUrl(url: string, fieldName: string): void {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('Protocol must be http or https');
    }
  } catch (error) {
    throw new PocketPayError(
      `Invalid ${fieldName}: "${url}". Must be a valid HTTP(S) URL.`,
      `INVALID_${fieldName.toUpperCase()}`
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
  validateUrl(url, 'Horizon URL');
}

/**
 * Validates Soroban RPC URL format.
 *
 * @param url - The URL to validate
 * @throws PocketPayError if URL is invalid
 */
export function validateSorobanRpcUrl(url: string): void {
  validateUrl(url, 'Soroban RPC URL');
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
 * All configuration values are validated before returning.
 *
 * @param overrides - Optional partial config to override defaults
 * @returns Fully resolved and validated SDK configuration
 * @throws PocketPayError if any configuration value is invalid
 */
export function resolveConfig(overrides?: Partial<SDKConfig>): SDKConfig {
  const network: unknown =
    overrides?.network ??
    process.env.STELLAR_NETWORK ??
    'testnet';

  // Validate network
  validateNetwork(network);

  const horizonUrl =
    overrides?.horizonUrl ||
    process.env.STELLAR_HORIZON_URL ||
    HORIZON_URLS[network];

  // Validate Horizon URL
  validateHorizonUrl(horizonUrl);

  const sorobanRpcUrl =
    overrides?.sorobanRpcUrl ||
    process.env.STELLAR_SOROBAN_RPC_URL ||
    SOROBAN_RPC_URLS[network];

  // Validate Soroban RPC URL
  validateSorobanRpcUrl(sorobanRpcUrl);

  // Validate timeout if provided
  const timeout = overrides?.timeout ?? (process.env.STELLAR_TIMEOUT
    ? parseInt(process.env.STELLAR_TIMEOUT, 10)
    : undefined);

  if (timeout !== undefined) {
    validateTimeout(timeout);
  }

  // Validate contract ID if provided
  const contractId = overrides?.contractId || process.env.STELLAR_CONTRACT_ID;

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
