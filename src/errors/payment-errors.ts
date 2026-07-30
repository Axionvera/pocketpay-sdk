export enum PaymentErrorCode {
  InvalidAddress = 'INVALID_ADDRESS',
  InvalidAmount = 'INVALID_AMOUNT',
  InvalidAsset = 'INVALID_ASSET',
  InvalidMemo = 'INVALID_MEMO',
  InvalidMetadata = 'INVALID_METADATA',
}

export class PaymentParseError extends Error {
  code: PaymentErrorCode;
  constructor(message: string, code: PaymentErrorCode) {
    super(message);
    this.name = 'PaymentParseError';
    this.code = code;
  }
}