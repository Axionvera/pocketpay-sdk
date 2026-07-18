import { PocketPayError } from '../types';

const FALLBACK_TIMEOUT_MS = 30_000;

function timeoutError(operation: string, timeoutMs: number): PocketPayError {
  return new PocketPayError(
    `${operation} timed out after ${timeoutMs}ms`,
    'REQUEST_TIMEOUT',
  );
}

/**
 * Applies SDK timeout handling to promise-based network operations.
 */
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
 * Fetch wrapper that aborts when AbortController is available and otherwise
 * still rejects with the same timeout error for older runtimes.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  operation: string,
  timeoutMs: number | undefined,
): Promise<Response> {
  const effectiveTimeoutMs = timeoutMs ?? FALLBACK_TIMEOUT_MS;

  if (typeof AbortController === 'undefined') {
    return withTimeout(operation, effectiveTimeoutMs, fetch(url, init));
  }

  const controller = new AbortController();
  let abortedByTimeout = false;
  const timeoutId = setTimeout(() => {
    abortedByTimeout = true;
    controller.abort();
  }, effectiveTimeoutMs);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (abortedByTimeout) {
      throw timeoutError(operation, effectiveTimeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }
}
