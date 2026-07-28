/**
 * sequence.ts — account sequence handling and concurrent submission safety.
 * ──────────────────────────────────────────────────────────────────────────────
 * Every Stellar transaction carries the source account's sequence number, and
 * the network accepts exactly one transaction per sequence value. Two intents
 * built from the same account therefore conflict unless something coordinates
 * them: both read the same sequence from Horizon, both build an envelope for
 * `sequence + 1`, and the second submission is rejected with `tx_bad_seq`.
 *
 * This module provides the coordination seam the SDK was missing:
 *
 *  - {@link SequenceProvider.get}        — cached read with a freshness marker
 *  - {@link SequenceProvider.refresh}    — force a re-read from Horizon
 *  - {@link SequenceProvider.invalidate} — drop a cached value after use or failure
 *  - {@link SequenceProvider.withSequence} — opt-in serialization of a build +
 *    submit section, so concurrent intents on one account run in order
 *
 * ## Scope of the guarantee
 *
 * `withSequence` serializes **within a single process**, because it is backed
 * by an in-memory promise chain. It does not coordinate across workers,
 * containers, or machines. Multiple processes submitting for the same account
 * still need external coordination — see `docs/sequence-safety.md`.
 *
 * ## Why sequences are not pre-allocated
 *
 * Handing each caller `sequence + 1`, `sequence + 2`, … without waiting would
 * remove the need to serialize, but a single failed submission leaves a gap and
 * every later transaction in the batch becomes permanently invalid. This module
 * deliberately re-reads from Horizon after each use instead.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer } from '../config';
import { withTimeout } from '../network';
import { PocketPayError } from '../types';
import type { SDKConfig } from '../types';
import { ErrorCode, ERROR_CODES } from '../errors/codes';

/** Default age after which a cached sequence is considered stale. */
export const DEFAULT_SEQUENCE_MAX_AGE_MS = 15_000;

/** A sequence value together with when it was read. */
export interface SequenceSnapshot {
  /** Account the sequence belongs to. */
  publicKey: string;
  /** The account's current sequence number, as returned by Horizon. */
  sequence: string;
  /** Epoch milliseconds at which the value was read. */
  fetchedAt: number;
}

/** Options accepted by {@link SequenceProvider}. */
export interface SequenceProviderOptions {
  /**
   * How long a cached sequence stays usable, in milliseconds.
   * Defaults to {@link DEFAULT_SEQUENCE_MAX_AGE_MS}. Pass `0` to disable
   * caching entirely and always read from Horizon.
   */
  maxAgeMs?: number;
  /** SDK config overrides used for the Horizon lookup. */
  config?: Partial<SDKConfig>;
}

/** Builds the typed error for a rejected sequence value. */
function sequenceError(reason: string, message: string, value?: string): PocketPayError {
  const spec = ERROR_CODES[ErrorCode.TX_BAD_SEQUENCE];
  return new PocketPayError(message, ErrorCode.TX_BAD_SEQUENCE, {
    category: spec.category,
    safeMessage: spec.safeMessage,
    validation: { field: 'sequence', reason, value },
  });
}

/**
 * Validates that a value is usable as a Stellar sequence number.
 *
 * Sequence numbers are unsigned 64-bit integers supplied as decimal strings.
 * This is exported so callers that supply a sequence manually — such as fully
 * offline transaction preparation — can reject malformed input up front instead
 * of discovering it at submission time.
 *
 * @param sequence - The candidate sequence value
 * @returns true when the value is well-formed
 * @throws PocketPayError with code `TX_BAD_SEQUENCE` when it is not
 */
export function validateSequenceValue(sequence: unknown): boolean {
  if (typeof sequence !== 'string' && typeof sequence !== 'number' && typeof sequence !== 'bigint') {
    throw sequenceError(
      'invalid_type',
      `A sequence number must be a decimal string, got ${typeof sequence}.`
    );
  }

  const raw = String(sequence).trim();
  if (raw.length === 0) {
    throw sequenceError('empty', 'A sequence number is required but was empty.');
  }
  if (!/^\d+$/.test(raw)) {
    throw sequenceError(
      'not_unsigned_integer',
      `A sequence number must be an unsigned integer, got "${raw}".`,
      raw
    );
  }
  return true;
}

/**
 * Reports whether a snapshot has aged past `maxAgeMs`.
 *
 * @param snapshot - A previously captured sequence snapshot
 * @param maxAgeMs - Maximum acceptable age (default {@link DEFAULT_SEQUENCE_MAX_AGE_MS})
 * @param now - Injectable clock, for tests
 */
export function isSequenceStale(
  snapshot: Pick<SequenceSnapshot, 'fetchedAt'>,
  maxAgeMs: number = DEFAULT_SEQUENCE_MAX_AGE_MS,
  now: number = Date.now()
): boolean {
  return now - snapshot.fetchedAt >= maxAgeMs;
}

/**
 * Caches account sequence numbers and, on request, serializes the transaction
 * intents that consume them.
 *
 * @example Read with caching
 * ```ts
 * const sequences = new SequenceProvider();
 * const snapshot = await sequences.get(publicKey);
 * ```
 *
 * @example Serialize concurrent intents on one account
 * ```ts
 * await Promise.all([
 *   sequences.withSequence(publicKey, () => sendXLM(paymentA)),
 *   sequences.withSequence(publicKey, () => sendXLM(paymentB)),
 * ]);
 * ```
 */
export class SequenceProvider {
  private readonly cache = new Map<string, SequenceSnapshot>();
  /** Per-account tail of the serialization chain used by `withSequence`. */
  private readonly chains = new Map<string, Promise<unknown>>();
  private readonly maxAgeMs: number;
  private readonly config?: Partial<SDKConfig>;

  constructor(options: SequenceProviderOptions = {}) {
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_SEQUENCE_MAX_AGE_MS;
    this.config = options.config;
  }

  /**
   * Returns the account's sequence, reading from Horizon when there is no
   * cached value or the cached one has gone stale.
   *
   * @param publicKey - The source account
   */
  async get(publicKey: string): Promise<SequenceSnapshot> {
    const cached = this.cache.get(publicKey);
    if (cached && this.maxAgeMs > 0 && !isSequenceStale(cached, this.maxAgeMs)) {
      return cached;
    }
    return this.refresh(publicKey);
  }

  /**
   * Reads the account's sequence from Horizon, bypassing and replacing any
   * cached value.
   *
   * @param publicKey - The source account
   */
  async refresh(publicKey: string): Promise<SequenceSnapshot> {
    const server = getHorizonServer(this.config);
    const timeout = this.config?.timeout;

    const account = await withTimeout(
      'Horizon source account lookup',
      timeout,
      server.loadAccount(publicKey)
    );

    const snapshot: SequenceSnapshot = {
      publicKey,
      sequence: account.sequence,
      fetchedAt: Date.now(),
    };
    this.cache.set(publicKey, snapshot);
    return snapshot;
  }

  /**
   * Drops cached sequences. Call this after a submission — successful or not —
   * so the next intent re-reads the account's real state.
   *
   * @param publicKey - Account to forget; omit to clear every cached account
   */
  invalidate(publicKey?: string): void {
    if (publicKey === undefined) {
      this.cache.clear();
      return;
    }
    this.cache.delete(publicKey);
  }

  /** Returns the cached snapshot without touching the network, if any. */
  peek(publicKey: string): SequenceSnapshot | undefined {
    return this.cache.get(publicKey);
  }

  /**
   * Runs `task` with exclusive access to the account, so concurrent intents on
   * the same source execute one after another instead of racing for the same
   * sequence number. The cached sequence is invalidated after each task, so the
   * next one reads fresh state.
   *
   * Serialization is **per process** — it is an in-memory chain and does not
   * coordinate across workers or machines.
   *
   * @param publicKey - The source account to serialize on
   * @param task - The work to run exclusively (typically build + submit)
   * @returns Whatever `task` resolves to
   */
  async withSequence<T>(publicKey: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(publicKey) ?? Promise.resolve();

    // Swallow the predecessor's rejection so one failed intent does not cascade
    // into every queued intent for the account; each caller still sees its own.
    const run = previous.catch(() => undefined).then(async () => {
      try {
        return await task();
      } finally {
        this.invalidate(publicKey);
      }
    });

    this.chains.set(publicKey, run);

    try {
      return await run;
    } finally {
      // Drop the chain once this task is the tail, so the map does not grow.
      if (this.chains.get(publicKey) === run) {
        this.chains.delete(publicKey);
      }
    }
  }

  /**
   * Builds a `StellarSDK.Account` positioned at the account's current sequence,
   * ready to hand to `TransactionBuilder`.
   *
   * @param publicKey - The source account
   */
  async loadAccount(publicKey: string): Promise<StellarSDK.Account> {
    const snapshot = await this.get(publicKey);
    return new StellarSDK.Account(publicKey, snapshot.sequence);
  }
}

/**
 * A process-wide provider, for callers that just want sequence safety without
 * wiring an instance through their own code.
 */
export const defaultSequenceProvider = new SequenceProvider();
