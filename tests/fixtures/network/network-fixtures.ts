import { NetworkBuilder } from './network-builder';

/**
 * Baseline network response fixtures
 */
export const networkFixtures = {
  /**
   * A successful network response
   */
  success: new NetworkBuilder()
    .withStatus(200)
    .withData({ success: true, result: 'success' })
    .build(),

  /**
   * A network timeout
   */
  timeout: new NetworkBuilder()
    .withStatus(504)
    .withError('Timeout')
    .withTimeout(true)
    .build(),

  /**
   * A network error (500)
   */
  serverError: new NetworkBuilder()
    .withStatus(500)
    .withError('Internal Server Error')
    .build(),

  /**
   * A network error (404)
   */
  notFound: new NetworkBuilder()
    .withStatus(404)
    .withError('Not Found')
    .build(),

  /**
   * A network error (403)
   */
  forbidden: new NetworkBuilder()
    .withStatus(403)
    .withError('Forbidden')
    .build(),

  /**
   * A network error (429) - rate limited
   */
  rateLimited: new NetworkBuilder()
    .withStatus(429)
    .withError('Rate Limited')
    .withHeaders({ 'Retry-After': '60' })
    .build(),
};

export type NetworkFixtureType = keyof typeof networkFixtures;
export const networkFixtureNames = Object.keys(networkFixtures) as NetworkFixtureType[];
