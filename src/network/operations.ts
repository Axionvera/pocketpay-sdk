import { PocketPayError } from '../types';
import { wrapError } from '../utils';

const FALLBACK_TIMEOUT_MS = 30_000;

function timeoutError(operation: string, timeoutMs: number): PocketPayError {
  return new PocketPayError(`${operation} timed out after ${timeoutMs}ms`, 'REQUEST_TIMEOUT');
}

export function withTimeout<T>(
  operation: string,
  timeoutMs: number | undefined,
  request: Promise<T>,
): Promise<T> {
  const effectiveTimeoutMs = timeoutMs ?? FALLBACK_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(timeoutError(operation, effectiveTimeoutMs)),
      effectiveTimeoutMs,
    );
  });

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

/**
 * Executes a Horizon server operation with timeout and consistent error handling.
 */
export async function executeHorizonOperation<T>(
  operation: string,
  timeoutMs: number | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await withTimeout(operation, timeoutMs, fn());
  } catch (error) {
    if (error instanceof PocketPayError) {
      throw error;
    }
    const horizonError = error as any;
    if (horizonError?.response?.status === 404) {
      throw new PocketPayError(
        'Resource not found',
        'NOT_FOUND',
        404,
      );
    }
    throw wrapError(error, operation, 'HORIZON_ERROR');
  }
}

/**
 * Executes a Soroban RPC operation with timeout and consistent error handling.
 */
export async function executeSorobanOperation<T>(
  operation: string,
  timeoutMs: number | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await withTimeout(operation, timeoutMs, fn());
  } catch (error) {
    if (error instanceof PocketPayError) {
      throw error;
    }
    throw wrapError(error, operation, 'SOROBAN_ERROR');
  }
}
