import { AccountBuilder } from './account-builder';

/**
 * Baseline account fixtures
 */
export const accountFixtures = {
  /**
   * A valid, funded account
   */
  valid: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    .withBalance('1000.00')
    .withSequence(123456789)
    .build(),

  /**
   * An account with no balance
   */
  empty: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891')
    .withBalance('0.00')
    .withSequence(123456789)
    .build(),

  /**
   * An account with a small balance
   */
  lowBalance: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567892')
    .withBalance('0.01')
    .withSequence(123456789)
    .build(),

  /**
   * An account with a large balance
   */
  highBalance: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567893')
    .withBalance('1000000.00')
    .withSequence(123456789)
    .build(),

  /**
   * An account that does not exist
   */
  notFound: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567899')
    .withExists(false)
    .build(),

  /**
   * An account with a pending transaction
   */
  pending: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567894')
    .withBalance('1000.00')
    .withSequence(123456789)
    .withPendingTransaction(true)
    .build(),

  /**
   * A frozen account
   */
  frozen: new AccountBuilder()
    .withId('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567895')
    .withBalance('1000.00')
    .withSequence(123456789)
    .withFrozen(true)
    .build(),
};

export type AccountFixtureType = keyof typeof accountFixtures;
export const accountFixtureNames = Object.keys(accountFixtures) as AccountFixtureType[];
