export const fundedAccount = {
  id: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  account_id: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  sequence: '123914544434135042',
  balances: [
    {
      balance: '1000.0000000',
      asset_type: 'native',
    },
    {
      balance: '500.0000000',
      asset_code: 'USDC',
      asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    },
  ],
  signers: [
    {
      key: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      weight: 1,
    },
  ],
  thresholds: {
    low_threshold: 0,
    med_threshold: 0,
    high_threshold: 0,
  },
};

export const unfundedAccount = {
  type: 'https://stellar.org/horizon-errors/not_found',
  title: 'Resource Missing',
  status: 404,
  detail: 'The resource at the url requested was not found.',
};

export const accountNotFound = {
  type: 'https://stellar.org/horizon-errors/not_found',
  title: 'Resource Missing',
  status: 404,
  detail: 'The resource at the url requested was not found.',
};