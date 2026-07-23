import { describe, it, expect, vi } from 'vitest';
import {
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
} from '../src/soroban/mapper';
import { PocketPayError } from '../src/types';
import * as StellarSDK from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Api: {
        isSimulationError: vi.fn((resp: any) => Boolean(resp && resp.isSimError)),
      },
    },
    scValToNative: vi.fn((scVal: any) => {
      if (scVal && scVal.value !== undefined) return scVal.value;
      return scVal;
    }),
  };
});

describe('Soroban Invocation Result Mapper', () => {
  describe('mapSorobanInvocationResult', () => {
    it('handles null or undefined input safely', () => {
      const resNull = mapSorobanInvocationResult(null);
      expect(resNull).toEqual({
        success: false,
        status: 'error',
        error: 'Empty or null response received from Soroban contract',
        errorCode: 'NULL_RESPONSE',
        rawResponse: null,
      });

      const resUndef = mapSorobanInvocationResult(undefined);
      expect(resUndef.success).toBe(false);
      expect(resUndef.status).toBe('error');
    });

    it('maps primitive boolean values', () => {
      expect(mapSorobanInvocationResult(true)).toEqual({
        success: true,
        status: 'success',
        result: true,
        rawResponse: true,
      });

      expect(mapSorobanInvocationResult(false)).toEqual({
        success: false,
        status: 'failed',
        result: false,
        rawResponse: false,
      });
    });

    it('maps primitive numeric and string return values', () => {
      expect(mapSorobanInvocationResult(100)).toEqual({
        success: true,
        status: 'success',
        result: 100,
        rawResponse: 100,
      });

      expect(mapSorobanInvocationResult('success_token')).toEqual({
        success: true,
        status: 'success',
        result: 'success_token',
        rawResponse: 'success_token',
      });
    });

    it('maps simulation errors correctly', () => {
      const simErrResp = { isSimError: true, error: 'Host function panic' };
      const mapped = mapSorobanInvocationResult(simErrResp);
      expect(mapped).toEqual({
        success: false,
        status: 'simulation_error',
        error: 'Simulation failed: Host function panic',
        errorCode: 'SIMULATION_FAILED',
        rawResponse: simErrResp,
      });
    });

    it('maps explicit simulation error strings', () => {
      const resp = { error: 'Simulation failed: Exceeded compute budget' };
      const mapped = mapSorobanInvocationResult(resp);
      expect(mapped.status).toBe('simulation_error');
      expect(mapped.error).toContain('Exceeded compute budget');
    });

    it('maps sendTransaction ERROR responses', () => {
      const sendErr = { status: 'ERROR', errorResult: 'tx_bad_auth', hash: 'abc123hash' };
      const mapped = mapSorobanInvocationResult(sendErr);
      expect(mapped).toEqual({
        success: false,
        status: 'failed',
        error: 'Send error: tx_bad_auth',
        errorCode: 'SUBMISSION_ERROR',
        hash: 'abc123hash',
        rawResponse: sendErr,
      });
    });

    it('maps getTransaction FAILED or NOT_FOUND status', () => {
      const failedTx = { status: 'FAILED', hash: 'failedhash' };
      const mapped = mapSorobanInvocationResult(failedTx);
      expect(mapped).toEqual({
        success: false,
        status: 'failed',
        error: 'Transaction status: FAILED',
        errorCode: 'TX_STATUS_FAILED',
        hash: 'failedhash',
        rawResponse: failedTx,
      });
    });

    it('maps successful simulation containing retval', () => {
      const simSuccess = {
        result: {
          retval: { value: 50000000n },
        },
      };
      const mapped = mapSorobanInvocationResult(simSuccess);
      expect(mapped).toEqual({
        success: true,
        status: 'success',
        result: 50000000n,
        rawResponse: simSuccess,
      });
    });

    it('maps completed status SUCCESS transactions', () => {
      const successTx = { status: 'SUCCESS', hash: 'tx123', result: 'ok' };
      const mapped = mapSorobanInvocationResult(successTx);
      expect(mapped).toEqual({
        success: true,
        status: 'success',
        hash: 'tx123',
        result: 'ok',
        rawResponse: successTx,
      });
    });

    it('maps pending transaction status', () => {
      const pendingTx = { status: 'PENDING', hash: 'txPending' };
      const mapped = mapSorobanInvocationResult(pendingTx);
      expect(mapped).toEqual({
        success: true,
        status: 'pending',
        hash: 'txPending',
        rawResponse: pendingTx,
      });
    });
  });

  describe('mapVaultInvocationResult', () => {
    it('maps get_balance operation with XLM formatted string', () => {
      const raw = { success: true, balance: '25.5000000' };
      const mapped = mapVaultInvocationResult('get_balance', raw, { contractId: 'C123' });
      expect(mapped).toEqual({
        success: true,
        status: 'success',
        operation: 'get_balance',
        balance: '25.5000000',
        rawStroops: '255000000',
      });
    });

    it('maps get_balance operation with raw stroops integer/bigint', () => {
      const raw = 150000000n; // 15 XLM
      const mapped = mapVaultInvocationResult('get_balance', raw);
      expect(mapped).toEqual({
        success: true,
        status: 'success',
        operation: 'get_balance',
        balance: '15.0000000',
        rawStroops: '150000000',
      });
    });

    it('maps successful deposit operation', () => {
      const raw = { status: 'SUCCESS', hash: 'deposithash' };
      const mapped = mapVaultInvocationResult('deposit', raw, { amount: '100', contractId: 'C123' });
      expect(mapped).toEqual({
        success: true,
        status: 'success',
        operation: 'deposit',
        hash: 'deposithash',
        amount: '100',
      });
    });

    it('maps failed withdrawal simulation', () => {
      const raw = { isSimError: true, error: 'Insufficient vault balance' };
      const mapped = mapVaultInvocationResult('withdraw', raw, { amount: '50' });
      expect(mapped).toEqual({
        success: false,
        status: 'simulation_error',
        operation: 'withdraw',
        hash: undefined,
        amount: '50',
        error: 'Simulation failed: Insufficient vault balance',
        errorCode: 'SIMULATION_FAILED',
      });
    });
  });

  describe('mapSorobanContractError', () => {
    it('handles PocketPayError instances', () => {
      const err = new PocketPayError('Invalid params', 'INVALID_PARAM');
      const mapped = mapSorobanContractError(err);
      expect(mapped).toEqual({
        error: 'Invalid params',
        errorCode: 'INVALID_PARAM',
      });
    });

    it('classifies simulation and missing contract ID errors from Error objects', () => {
      const simErr = new Error('Simulation failed: Out of gas');
      expect(mapSorobanContractError(simErr)).toEqual({
        error: 'Simulation failed: Out of gas',
        errorCode: 'SIMULATION_ERROR',
      });

      const missingId = new Error('Vault contract ID is required');
      expect(mapSorobanContractError(missingId)).toEqual({
        error: 'Vault contract ID is required',
        errorCode: 'MISSING_CONTRACT_ID',
      });
    });

    it('handles custom object error representations', () => {
      const customErr = { code: 'UNAUTHORIZED', message: 'Caller is not admin' };
      expect(mapSorobanContractError(customErr)).toEqual({
        error: 'Caller is not admin',
        errorCode: 'UNAUTHORIZED',
      });
    });

    it('handles primitive string errors', () => {
      expect(mapSorobanContractError('Resource limit exceeded')).toEqual({
        error: 'Resource limit exceeded',
        errorCode: 'SOROBAN_ERROR',
      });
    });
  });
});
