/**
 * Stellar PocketPay SDK — Vault Module
 *
 * Dedicated vault module providing helpers and result mappers for Soroban savings vault interactions.
 */

export {
  depositToVault,
  withdrawFromVault,
  getVaultBalance,
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
