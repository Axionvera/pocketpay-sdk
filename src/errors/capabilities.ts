/**
 * capabilities.ts — the SDK capability registry.
 * ──────────────────────────────────────────────────────────────────────────────
 * Declares which SDK capabilities are fully supported, which are gated behind
 * configuration, and which are declared in the public type surface but not
 * usable yet. Consumers can inspect this before calling, instead of discovering
 * gaps through failures.
 *
 * Statuses are deliberately factual. Nothing here promises a delivery date or
 * a future release — `docs/roadmap.md` is explicit that the roadmap is
 * directional and carries no commitments, and this registry keeps that tone.
 *
 * Dependency note: this module reads only from `./codes` and `../types`. It must
 * never import from `../config`, `../soroban` or `../vault` — `src/errors/*`
 * sits below them and importing upward would create a cycle
 * (`scripts/check-circular-deps.ts`).
 */

import { ErrorCode } from './codes';
import {
  CapabilityMismatchError,
  UnsupportedFeatureError,
  type FeatureContext,
} from './unsupported';

/**
 * Lifecycle status of an SDK capability.
 *
 *  - `supported`    — implemented and usable with the default configuration.
 *  - `config-gated` — implemented, but inert until the required configuration
 *                     is supplied. Calling it raises {@link CapabilityMismatchError}.
 *  - `planned`      — an extension point exists in the public type surface, but
 *                     no implementation ships today. Calling it raises
 *                     {@link UnsupportedFeatureError}.
 *  - `unsupported`  — declared in the public type surface and not usable, with
 *                     no implementation expected from this SDK. Calling it
 *                     raises {@link UnsupportedFeatureError}.
 *
 * `planned` carries no delivery commitment; see `docs/roadmap.md`.
 */
export type CapabilityStatus = 'supported' | 'config-gated' | 'planned' | 'unsupported';

/** Describes a single SDK capability. */
export interface CapabilitySpec {
  /** Current status of the capability. */
  status: CapabilityStatus;
  /** SDK module that owns the capability. */
  module: string;
  /** What the consumer must configure. Only meaningful for `config-gated`. */
  requires?: string;
  /** Factual one-line description. No delivery promises. */
  description: string;
}

/**
 * The published capability registry, keyed by dot-scoped capability name.
 *
 * Only capabilities whose status has been verified against the code appear
 * here. Absence from this registry means "not classified", not "supported".
 */
export const SDK_CAPABILITIES: Record<string, CapabilitySpec> = {
  'vault.contract': {
    status: 'config-gated',
    module: 'vault',
    requires: 'SDKConfig.contractId, or the VAULT_CONTRACT_ID / STELLAR_CONTRACT_ID env var',
    description:
      'Soroban savings-vault calls (deposit, withdraw, get_balance) against a deployed contract.',
  },
  'vault.lock': {
    status: 'planned',
    module: 'vault',
    description:
      'Time-locked vault positions: lock creation, lock listing and matured-lock ' +
      'withdrawal. The deployed savings-vault contract exposes deposit, withdraw ' +
      'and get_balance only, so no SDK path can perform these today.',
  },
  'soroban.contract-client': {
    status: 'config-gated',
    module: 'soroban',
    requires: 'ContractClientConfig.contractId',
    description: 'Generic contract client for read-only calls and invocations.',
  },
  'soroban.param-type.vec': {
    status: 'unsupported',
    module: 'soroban',
    description:
      "The 'vec' member of ScValType is declared in the public parameter surface, but the " +
      'underlying Stellar SDK rejects it during encoding.',
  },
  'wallet.testnet-funding': {
    status: 'config-gated',
    module: 'wallet',
    requires: 'SDKConfig.network set to "testnet"',
    description:
      'Funding an account through Friendbot. Friendbot is a testnet-only service, so this ' +
      'capability is unavailable on mainnet.',
  },
  'signer.local': {
    status: 'supported',
    module: 'account',
    description: 'Transaction signing with a Stellar keypair held in local memory (LocalSigner).',
  },
  'signer.remote': {
    status: 'planned',
    module: 'account',
    description:
      'The Signer interface is designed so async or remote signers can be substituted for ' +
      'LocalSigner, but this SDK ships no remote implementation. Consumers may supply their own.',
  },
} as const;

/** Returns the spec for a capability, or `undefined` when it is not classified. */
export function getCapability(capability: string): CapabilitySpec | undefined {
  return SDK_CAPABILITIES[capability];
}

/** Lists capability names filtered by status. */
export function listCapabilities(status?: CapabilityStatus): string[] {
  const names = Object.keys(SDK_CAPABILITIES);
  if (!status) return names;
  return names.filter((name) => SDK_CAPABILITIES[name as keyof typeof SDK_CAPABILITIES]?.status === status);
}

/**
 * Throws the standard error when a capability cannot be used.
 *
 * `unsupported` capabilities raise {@link UnsupportedFeatureError}; everything
 * else raises {@link CapabilityMismatchError} carrying `code`. Returns normally
 * when `available` is true, so call sites read as a guard.
 *
 * @param capability - Dot-scoped capability name, e.g. 'vault.contract'
 * @param available - Whether the capability's requirement is satisfied
 * @param context - Module / operation the caller attempted
 * @param options - Registry code to use for config-gated failures, plus an
 *                  optional message override
 */
export function assertCapability(
  capability: string,
  available: boolean,
  context: Omit<FeatureContext, 'capability'>,
  options?: { code?: typeof ErrorCode[keyof typeof ErrorCode]; message?: string }
): void {
  if (available) return;

  const spec = SDK_CAPABILITIES[capability];

  if (spec?.status === 'unsupported' || spec?.status === 'planned') {
    throw new UnsupportedFeatureError({
      module: context.module,
      operation: context.operation,
      capability,
      message: options?.message,
    });
  }

  throw new CapabilityMismatchError({
    code: options?.code ?? ErrorCode.SDK_CONFIG_INVALID,
    module: context.module,
    operation: context.operation,
    capability,
    message: options?.message,
  });
}
