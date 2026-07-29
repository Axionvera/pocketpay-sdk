# Simulation result mapping

The SDK converts raw Soroban `simulateTransaction` responses into a typed
{@link SimulationMappedResult} with one of five statuses:

| Status | `success` | Meaning |
| --- | --- | --- |
| `success` | `true` | Simulation completed; safe to assemble / sign when applicable |
| `warning` | `true` | Simulation completed with non-fatal advisories (events, RPC warnings) |
| `failed` | `false` | Simulation returned a contract or runtime error |
| `unsupported` | `false` | Response requires a path this client cannot complete (e.g. state restore) |
| `unknown` | `false` | Response shape could not be classified safely |

## API

```ts
import {
  mapSimulationResult,
  simulateContractCall,
  pocketPayErrorFromSimulation,
  ErrorCode,
} from 'stellar-pocketpay-sdk';

const mapped = mapSimulationResult(rawRpcResponse);

if (!mapped.success) {
  // failed | unsupported | unknown — do not sign
  throw pocketPayErrorFromSimulation(mapped);
}

if (mapped.status === 'warning') {
  // Inspect mapped.warnings before proceeding
}

// success — use cost metrics / retval as needed
console.log(mapped.cost?.minResourceFee);
```

`simulateContractCall()` runs a dry-run against Soroban RPC and returns the same
mapped shape (`ContractSimulationResult`).

## Soroban client integration

`ContractClient` (`readOnly`, `invoke`, and auth simulation) runs every response
through `mapSimulationResult` before assembling or signing:

- **readOnly** — throws a typed `PocketPayError` when `success` is false
- **invoke** — returns `{ success: false, status: 'simulation_error', simulationStatus }`
  without signing when simulation is not proceedable
- **warning** — treated as proceedable; `warnings` are attached to successful invoke results

Error codes:

- `SOROBAN_SIMULATION_FAILED` — `failed`
- `SOROBAN_SIMULATION_UNSUPPORTED` — `unsupported` (e.g. restore preamble)
- `SOROBAN_SIMULATION_UNKNOWN` — unclassifiable payload

Contract-specific remaps (via `ContractClient` error maps) still apply on the
simulation `error` string before the default Soroban codes.

## Safety

- Mapped results may include `rawSimulation` for diagnostics; the SDK does not
  log raw RPC payloads.
- Prefer checking `status` (not only `success`) when handling restore /
  unknown cases differently from contract failures.
- Do not prompt for signatures when `success` is `false`.

See also [Signing boundaries](./signing-boundaries.md).
