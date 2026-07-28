import { describe, it, expect } from 'vitest';
import { findAssetBalance, AssetBalance } from '../src';

const balances: AssetBalance[] = [
  { asset: 'XLM', balance: '500.0000000', issuer: '' },
  { asset: 'USDC', balance: '100.0000000', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
  { asset: 'USDC', balance: '50.0000000', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
  { asset: 'EURT', balance: '200.0000000', issuer: 'GAP5LETOR6G2XPXLBSQ2Q3Z6G2ER46K2B6D4S3OC2G5C5B5F5A5B5C5D' },
];

describe('findAssetBalance', () => {
  it('returns native XLM balance when searching for "XLM"', () => {
    const result = findAssetBalance(balances, 'XLM');
    expect(result).toBeDefined();
    expect(result).toMatchObject({ asset: 'XLM', balance: '500.0000000', issuer: '' });
  });

  it('returns undefined when XLM is not present', () => {
    const result = findAssetBalance([], 'XLM');
    expect(result).toBeUndefined();
  });

  it('finds an issued asset by code and issuer', () => {
    const result = findAssetBalance(
      balances,
      'USDC',
      'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    );
    expect(result).toBeDefined();
    expect(result).toMatchObject({ asset: 'USDC', balance: '100.0000000' });
  });

  it('finds an issued asset by code only (first match)', () => {
    const result = findAssetBalance(balances, 'USDC');
    expect(result).toBeDefined();
    expect(result!.asset).toBe('USDC');
    expect(result!.balance).toBe('100.0000000');
  });

  it('returns undefined for a non-existent asset code', () => {
    const result = findAssetBalance(balances, 'BTC');
    expect(result).toBeUndefined();
  });

  it('returns undefined when asset code exists but issuer does not match', () => {
    const result = findAssetBalance(
      balances,
      'USDC',
      'GAAAAAAAXXXXX',
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty balances array', () => {
    const result = findAssetBalance([], 'XLM');
    expect(result).toBeUndefined();
  });

  it('returns the correct balance amount for EURT', () => {
    const result = findAssetBalance(balances, 'EURT');
    expect(result).toBeDefined();
    expect(result!.balance).toBe('200.0000000');
  });
});
