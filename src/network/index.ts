import { PocketPayError } from '../types';
import { wrapError } from '../utils';

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

/**
 * Typed network client for making HTTP requests with consistent error handling,
 * timeout management, and response parsing.
 */
export class NetworkClient {
  private readonly baseUrl: string | undefined;
  private readonly defaultTimeoutMs: number;

  constructor(options?: { baseUrl?: string; defaultTimeoutMs?: number }) {
    this.baseUrl = options?.baseUrl;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? FALLBACK_TIMEOUT_MS;
  }

  /**
   * Performs a GET request and parses the JSON response.
   */
  async get<T>(
    path: string,
    options?: {
      timeoutMs?: number;
      headers?: Record<string, string>;
      operation?: string;
    },
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Performs a POST request with JSON body and parses the JSON response.
   */
  async post<T>(
    path: string,
    body?: unknown,
    options?: {
      timeoutMs?: number;
      headers?: Record<string, string>;
      operation?: string;
    },
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body,
      ...options,
    });
  }

  /**
   * Performs a generic HTTP request with JSON parsing and error handling.
   */
  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      timeoutMs?: number;
      headers?: Record<string, string>;
      operation?: string;
    },
  ): Promise<T> {
    const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
    const operation = options.operation || `${options.method} ${path}`;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const init: RequestInit = {
      method: options.method,
      headers,
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetchWithTimeout(
        url,
        init,
        operation,
        timeoutMs,
      );

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        const bodyStr =
          typeof errorBody === 'string'
            ? errorBody
            : (errorBody as any)?.detail || (errorBody as any)?.message || '';
        const msg = bodyStr
          ? `${operation} failed with status ${response.status}: ${bodyStr}`
          : `${operation} failed with status ${response.status}`;
        throw new PocketPayError(
          msg,
          `HTTP_ERROR_${response.status}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof PocketPayError) {
        throw error;
      }
      throw wrapError(error, operation, 'NETWORK_ERROR');
    }
  }
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

export { submitTransactionIdempotently, pollTransactionStatus } from './idempotency';

