import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, resolveConfig } from '../config';
import { FeeEstimate, SDKConfig } from '../types';
import { executeHorizonOperation } from './operations';

/**
 * Fetches the current fee estimation from the network.
 * If the network request fails, falls back to safe default minimums.
 * 
 * @param config Optional SDK config to determine network
 * @returns A FeeEstimate object containing tiered fee suggestions
 */
export async function fetchFeeEstimate(config?: Partial<SDKConfig>): Promise<FeeEstimate> {
  const cfg = resolveConfig(config);
  const server = getHorizonServer(config);
  
  try {
    const feeStats = await executeHorizonOperation(
      'Fetch fee stats',
      cfg.timeout,
      () => server.feeStats()
    );
    
    // Parse capacity usage to determine surge pricing (e.g. > 0.8)
    const capacityUsage = parseFloat(feeStats.ledger_capacity_usage);
    const surgePricing = capacityUsage > 0.8;

    return {
      high: String(feeStats.max_fee.p95),
      standard: String(feeStats.max_fee.p50),
      low: String(feeStats.max_fee.p10),
      baseFee: String(feeStats.last_ledger_base_fee),
      surgePricing,
      isFallback: false,
    };
  } catch (error) {
    // Fallback behaviour
    return {
      high: String(Number(StellarSDK.BASE_FEE) * 5),
      standard: String(Number(StellarSDK.BASE_FEE) * 2),
      low: String(StellarSDK.BASE_FEE),
      baseFee: String(StellarSDK.BASE_FEE),
      surgePricing: false,
      isFallback: true,
    };
  }
}
