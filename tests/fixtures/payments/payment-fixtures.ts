import { PaymentBuilder } from './payment-builder';

/**
 * Baseline payment fixtures
 */
export const paymentFixtures = {
  /**
   * A successful payment
   */
  success: new PaymentBuilder()
    .withFrom('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withTo('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVW')
    .withAmount('100.00')
    .withAsset('XLM')
    .withStatus('completed')
    .withTxHash('0x1234567890abcdef1234567890abcdef12345678')
    .build(),

  /**
   * A pending payment
   */
  pending: new PaymentBuilder()
    .withFrom('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withTo('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVW')
    .withAmount('100.00')
    .withAsset('XLM')
    .withStatus('pending')
    .build(),

  /**
   * A failed payment
   */
  failed: new PaymentBuilder()
    .withFrom('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withTo('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVW')
    .withAmount('100.00')
    .withAsset('XLM')
    .withStatus('failed')
    .withError('Insufficient balance')
    .build(),

  /**
   * A payment with a memo
   */
  withMemo: new PaymentBuilder()
    .withFrom('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withTo('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVW')
    .withAmount('100.00')
    .withAsset('XLM')
    .withMemo('Payment for services')
    .withStatus('completed')
    .build(),

  /**
   * A payment with USDC asset
   */
  usdc: new PaymentBuilder()
    .withFrom('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withTo('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVW')
    .withAmount('100.00')
    .withAsset('USDC')
    .withAssetIssuer('GUSDC1234567890')
    .withStatus('completed')
    .build(),
};

export type PaymentFixtureType = keyof typeof paymentFixtures;
export const paymentFixtureNames = Object.keys(paymentFixtures) as PaymentFixtureType[];
