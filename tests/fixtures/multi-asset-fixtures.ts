import { Asset, AssetMetadata, IssuedAsset, NativeAsset } from '../../src/types';

export const VALID_SOURCE_G = 'GBQ3UUVRLPBINPRTKWKPRQWKA4LYXJCTYYHR5DAICXVYXVFQ32P5CADH';
export const VALID_SOURCE_S = 'SDJVKPW3D66TYE4F7YV3P4RWWJ4A6L3A3Q4R3Q4R3Q4R3Q4R3Q4R3Q4R';
export const VALID_DESTINATION_G = 'GBMD2ACBNHKTDBF26BW7VZKPB3CXO63HVVYM26DBPLXK5J76ELTGUDG7';
export const VALID_ISSUER_USDC = 'GC7ZCFHCZJ6UWVN3EMR3HBDY75IWNXUOOZKCGYC3AQUF3PTVV4AYRIOZ';
export const VALID_ISSUER_EURT = 'GC7ZCFHCZJ6UWVN3EMR3HBDY75IWNXUOOZKCGYC3AQUF3PTVV4AYRIOZ';

export const NATIVE_XLM_FIXTURE: NativeAsset = {
  type: 'native',
  code: 'XLM',
};

export const ISSUED_USDC_FIXTURE: IssuedAsset = {
  type: 'issued',
  code: 'USDC',
  issuer: VALID_ISSUER_USDC,
};

export const ISSUED_EURT_FIXTURE: IssuedAsset = {
  type: 'issued',
  code: 'EURT',
  issuer: VALID_ISSUER_EURT,
};

export const USDC_METADATA_FIXTURE: AssetMetadata = {
  name: 'USD Coin',
  domain: 'centre.io',
  decimals: 7,
  iconUrl: 'https://centre.io/usdc.png',
  description: 'Circle USDC Dollar Stablecoin on Stellar',
  issuerName: 'Circle Financial Inc.',
};

export const RESTRICTED_ASSET_METADATA_FIXTURE: AssetMetadata = {
  name: 'Restricted Token',
  domain: 'restricted.io',
  decimals: 7,
  description: 'RESTRICTED compliance asset requiring KYC clearance',
};

export const MALFORMED_ASSETS_FIXTURE = {
  invalidType: { type: 'unknown', code: 'USDC' } as unknown as Asset,
  emptyCode: { type: 'issued', code: '', issuer: VALID_ISSUER_USDC } as unknown as Asset,
  codeTooLong: { type: 'issued', code: 'VERYLONGTOKENNAME', issuer: VALID_ISSUER_USDC } as unknown as Asset,
  xlmAsIssued: { type: 'issued', code: 'XLM', issuer: VALID_ISSUER_USDC } as unknown as Asset,
  invalidIssuer: { type: 'issued', code: 'USDC', issuer: 'INVALIDKEY' } as unknown as Asset,
};
