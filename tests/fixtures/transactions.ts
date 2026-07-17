export const transactionList = {
  _embedded: {
    records: [
      {
        id: 'abc123def456',
        paging_token: '123456789',
        successful: true,
        hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456',
        ledger: 5000000,
        created_at: '2024-01-15T10:30:00Z',
        source_account: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        fee_charged: 100,
        operation_count: 1,
        envelope_xdr: 'AAAAAgAAAAD...',
        result_xdr: 'AAAAAAAAAGQ...',
        result_meta_xdr: 'AAAAAQAAAAI...',
      },
      {
        id: 'def789ghi012',
        paging_token: '123456790',
        successful: true,
        hash: 'def789ghi012def789ghi012def789ghi012def789ghi012def789ghi012',
        ledger: 5000001,
        created_at: '2024-01-15T11:00:00Z',
        source_account: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        fee_charged: 100,
        operation_count: 2,
        envelope_xdr: 'AAAAAgAAAAD...',
        result_xdr: 'AAAAAAAAAGQ...',
        result_meta_xdr: 'AAAAAQAAAAI...',
      },
    ],
  },
};

export const failedTransaction = {
  id: 'fail123456789',
  paging_token: '123456791',
  successful: false,
  hash: 'fail123456789fail123456789fail123456789fail123456789fail123456',
  ledger: 5000002,
  created_at: '2024-01-15T11:30:00Z',
  source_account: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  fee_charged: 100,
  operation_count: 1,
  envelope_xdr: 'AAAAAgAAAAD...',
  result_xdr: 'AAAAAAAAAMQ...',
  result_meta_xdr: 'AAAAAQAAAAI...',
};

export const transactionNotFound = {
  type: 'https://stellar.org/horizon-errors/not_found',
  title: 'Resource Missing',
  status: 404,
  detail: 'The resource at the url requested was not found.',
};
