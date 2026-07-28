export const paymentList = {
  _embedded: {
    records: [
      {
        id: 'pay123456789',
        type: 'payment',
        paging_token: '987654321',
        transaction_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456',
        from: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        to: 'GDNOEY2L6EGCMAYNZWJN6K3K6TJJKAKNQJQJWY5HXLFY3LJQY7JJ6NVD',
        amount: '50.0000000',
        asset_type: 'native',
        created_at: '2024-01-15T10:30:00Z',
      },
      {
        id: 'pay987654321',
        type: 'payment',
        paging_token: '987654322',
        transaction_hash: 'def789ghi012def789ghi012def789ghi012def789ghi012def789ghi012',
        from: 'GDNOEY2L6EGCMAYNZWJN6K3K6TJJKAKNQJQJWY5HXLFY3LJQY7JJ6NVD',
        to: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        amount: '25.0000000',
        asset_code: 'USDC',
        asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        created_at: '2024-01-15T11:00:00Z',
      },
    ],
  },
};

export const paymentNotFound = {
  type: 'https://stellar.org/horizon-errors/not_found',
  title: 'Resource Missing',
  status: 404,
  detail: 'The resource at the url requested was not found.',
};

/** Builds an HTTP-style error that Horizon SDK throws for 404 responses. */
export function makeHorizon404Error(publicKey?: string) {
  const err = new Error(`Account not found: ${publicKey ?? 'unknown'}`) as any;
  err.response = { status: 404 };
  return err;
}

/** Builds a Horizon transaction-failure error with result codes (submission path). */
export function makeHorizonResultCodeError(
  transactionCode: string,
  operationCodes: string[] = [],
) {
  const err = new Error('Transaction failed') as any;
  err.response = {
    status: 400,
    data: {
      extras: {
        result_codes: {
          transaction: transactionCode,
          operations: operationCodes,
        },
      },
    },
  };
  return err;
}

/** A promise that never settles — used to trigger SDK timeout handling in tests. */
export function neverSettlingPromise<T = never>(): Promise<T> {
  return new Promise(() => undefined);
}
