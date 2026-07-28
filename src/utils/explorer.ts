import * as StellarSDK from '@stellar/stellar-sdk';
import { StellarNetwork, PocketPayError } from '../types';

/** Base URL for Stellar.Expert block explorer */
const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer';

/**
 * Builds a Stellar.Expert explorer link for a given resource.
 */
function buildExplorerLink(network: StellarNetwork, resource: string, id: string): string {
  // Stellar.Expert uses 'public' for mainnet, 'testnet' for testnet
  const networkSegment = network === 'mainnet' ? 'public' : 'testnet';
  return `${STELLAR_EXPERT_BASE}/${networkSegment}/${resource}/${id}`;
}

function validatePublicKeyLocal(publicKey: string): void {
  try {
    StellarSDK.Keypair.fromPublicKey(publicKey);
  } catch {
    throw new PocketPayError(
      `Invalid Stellar public key: ${publicKey}`,
      'INVALID_PUBLIC_KEY',
      {
        validation: {
          field: 'publicKey',
          reason: 'invalid_format',
          value: publicKey,
        },
      },
    );
  }
}

function validateTransactionHashLocal(hash: string): void {
  if (typeof hash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new PocketPayError(
      `Invalid transaction hash: ${hash}`,
      'INVALID_TRANSACTION_HASH',
    );
  }
}

/**
 * Generates a Stellar.Expert explorer link for a Stellar account.
 *
 * @param publicKey - The Stellar public key (G...)
 * @param network - The Stellar network ('testnet' | 'mainnet')
 * @returns The full explorer URL string
 * @throws PocketPayError if the public key format is invalid
 */
export function getAccountExplorerLink(publicKey: string, network: StellarNetwork): string {
  validatePublicKeyLocal(publicKey);
  return buildExplorerLink(network, 'account', publicKey);
}

/**
 * Generates a Stellar.Expert explorer link for a Stellar transaction.
 *
 * @param hash - The 64-character transaction hash
 * @param network - The Stellar network ('testnet' | 'mainnet')
 * @returns The full explorer URL string
 * @throws PocketPayError if the transaction hash format is invalid
 */
export function getTransactionExplorerLink(hash: string, network: StellarNetwork): string {
  validateTransactionHashLocal(hash);
  return buildExplorerLink(network, 'tx', hash);
}

/**
 * Generates a Stellar.Expert explorer link for a specific operation.
 *
 * @param operationId - The Stellar operation ID string (e.g. from PaymentSummary.id)
 * @param network - The Stellar network ('testnet' | 'mainnet')
 * @returns The full explorer URL string
 * @throws PocketPayError if the operation ID format is invalid
 */
export function getOperationExplorerLink(operationId: string, network: StellarNetwork): string {
  if (typeof operationId !== 'string' || operationId.trim().length === 0 || !/^\d+$/.test(operationId)) {
    throw new PocketPayError(
      `Invalid operation ID: ${operationId}`,
      'INVALID_OPERATION_ID',
    );
  }
  return buildExplorerLink(network, 'op', operationId);
}