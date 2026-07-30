// src/types/payment-payload.ts
/**
 * Payment payload shape emitted by QR codes.
 * Mirrors the URL query parameters parsed by QRParser.
 */
export interface PaymentPayload {
  /** Destination Stellar account (G… address) */
  address: string;
  /** Amount as a decimal string, positive, up to 7 decimal places */
  amount: string;
  /** Optional asset specification; native XLM if omitted */
  asset?: { code: string; issuer?: string };
  /** Optional memo, max 28 UTF‑8 bytes */
  memo?: string;
  /** Optional arbitrary key/value pairs */
  metadata?: Record<string, string>;
}

/**
 * Intent flags for QR‑generated payments.
 * Currently unused but reserved for future extensions.
 */
export type PaymentIntent = 'pay' | 'request';
