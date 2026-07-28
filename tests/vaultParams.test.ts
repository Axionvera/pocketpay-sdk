import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultDepositParams, VaultWithdrawParams, VaultBalanceParams } from '../src/types';

describe('Soroban Vault Request Models (Issue #88)', () => {
  const originalEnv = process.env.VAULT_CONTRACT_ID;

  beforeEach(() => {
    delete process.env.VAULT_CONTRACT_ID;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.VAULT_CONTRACT_ID = originalEnv;
    } else {
      delete process.env.VAULT_CONTRACT_ID;
    }
  });

  it('allows VaultDepositParams with optional contractId and shared fields', () => {
    const params: VaultDepositParams = {
      sourceSecret: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      amount: '50.5',
    };
    expect(params.sourceSecret).toBeDefined();
    expect(params.amount).toBe('50.5');
    expect(params.contractId).toBeUndefined();
  });

  it('allows VaultWithdrawParams with explicit contractId', () => {
    const params: VaultWithdrawParams = {
      sourceSecret: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      amount: '10',
      contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    };
    expect(params.contractId).toBe('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
  });

  it('allows VaultBalanceParams with optional contractId', () => {
    const params: VaultBalanceParams = {
      publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };
    expect(params.publicKey).toBeDefined();
    expect(params.contractId).toBeUndefined();
  });
});