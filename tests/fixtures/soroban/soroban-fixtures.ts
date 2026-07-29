import { SorobanBuilder } from './soroban-builder';

/**
 * Baseline Soroban call fixtures
 */
export const sorobanFixtures = {
  /**
   * A successful contract call
   */
  success: new SorobanBuilder()
    .withContractId('CA1234567890ABCDEF')
    .withMethod('deposit')
    .withResult({ success: true, amount: '100.00' })
    .build(),

  /**
   * A contract call with error
   */
  error: new SorobanBuilder()
    .withContractId('CA1234567890ABCDEF')
    .withMethod('deposit')
    .withResult({ success: false, error: 'Contract error' })
    .withError('Contract execution failed')
    .build(),

  /**
   * A contract call timeout
   */
  timeout: new SorobanBuilder()
    .withContractId('CA1234567890ABCDEF')
    .withMethod('deposit')
    .withTimeout(true)
    .build(),

  /**
   * An unsupported feature call
   */
  unsupported: new SorobanBuilder()
    .withContractId('CA1234567890ABCDEF')
    .withMethod('unsupported')
    .withError('Unsupported feature')
    .build(),
};

export type SorobanFixtureType = keyof typeof sorobanFixtures;
export const sorobanFixtureNames = Object.keys(sorobanFixtures) as SorobanFixtureType[];
