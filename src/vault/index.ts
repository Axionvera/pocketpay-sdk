/**
 * Stellar PocketPay SDK — Vault Module
 *
 * Dedicated vault module providing helpers and result mappers for Soroban savings vault interactions.
 * 
 * @security See the [SDK Security Threat Model](../../docs/security_threat_model.md)
 * for risks related to contract ID spoofing and malicious payload injection.
 */

export {
  depositToVault,
  withdrawFromVault,
  getVaultBalance,
  executeExperimentalVaultBatch,
  querySorobanEvents,
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
} from '../soroban';

export type {
  VaultDepositParams,
  VaultWithdrawParams,
  VaultBalanceParams,
  VaultResult,
  VaultMappedResult,
  VaultOperationType,
  SorobanInvocationStatus,
  SorobanInvocationResult,
  SorobanInvocationMapperOptions,
} from '../types';
