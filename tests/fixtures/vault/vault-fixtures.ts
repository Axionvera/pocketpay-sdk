import { VaultBuilder } from './vault-builder';

/**
 * Baseline vault fixtures
 */
export const vaultFixtures = {
  /**
   * A successful vault operation
   */
  success: new VaultBuilder()
    .withUserId('user_123')
    .withAmount('1000.00')
    .withAction('deposit')
    .withStatus('completed')
    .build(),

  /**
   * A pending vault operation
   */
  pending: new VaultBuilder()
    .withUserId('user_123')
    .withAmount('1000.00')
    .withAction('deposit')
    .withStatus('pending')
    .build(),

  /**
   * A failed vault operation
   */
  failed: new VaultBuilder()
    .withUserId('user_123')
    .withAmount('1000.00')
    .withAction('deposit')
    .withStatus('failed')
    .withError('Insufficient balance')
    .build(),

  /**
   * A lock operation
   */
  lock: new VaultBuilder()
    .withUserId('user_123')
    .withAmount('500.00')
    .withAction('lock')
    .withLockDuration(3600)
    .withStatus('completed')
    .build(),

  /**
   * An unlock operation
   */
  unlock: new VaultBuilder()
    .withUserId('user_123')
    .withAmount('500.00')
    .withAction('unlock')
    .withLockId('lock_123')
    .withStatus('completed')
    .build(),
};

export type VaultFixtureType = keyof typeof vaultFixtures;
export const vaultFixtureNames = Object.keys(vaultFixtures) as VaultFixtureType[];
