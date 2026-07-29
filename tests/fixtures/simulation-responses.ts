/**
 * Representative Soroban `simulateTransaction` response shapes for mapper tests.
 * These are structural fixtures — not live RPC captures.
 */

/** Successful simulation with a return value and cost metrics. */
export const simulationSuccessFixture = {
  id: 'simulation-success',
  response: {
    result: { retval: { mock: 'ok' } },
    minResourceFee: '100',
    cost: { cpuIns: '1000', memBytes: '2048' },
  },
} as const;

/** Success with diagnostic events → mapped as `warning`. */
export const simulationWarningFixture = {
  id: 'simulation-warning',
  response: {
    result: { retval: { mock: 'ok' } },
    minResourceFee: '100',
    events: [{ type: 'diagnostic', message: 'auth hint' }],
    warnings: [{ code: 'AUTH_HINT', message: 'Additional auth may be required' }],
  },
} as const;

/** Contract / runtime simulation failure. */
export const simulationFailedFixture = {
  id: 'simulation-failed',
  response: {
    error: 'HostError: Error(Contract, #1)',
  },
} as const;

/** Ledger entry restoration required — unsupported by the invoke path. */
export const simulationUnsupportedFixture = {
  id: 'simulation-unsupported',
  response: {
    restorePreamble: {
      minResourceFee: '500',
      transactionData: { mock: true },
    },
  },
} as const;

/** Unclassifiable payload. */
export const simulationUnknownFixture = {
  id: 'simulation-unknown',
  response: {
    unexpected: true,
    payload: 'not-a-simulation',
  },
} as const;

export const simulationFixtures = [
  simulationSuccessFixture,
  simulationWarningFixture,
  simulationFailedFixture,
  simulationUnsupportedFixture,
  simulationUnknownFixture,
] as const;
