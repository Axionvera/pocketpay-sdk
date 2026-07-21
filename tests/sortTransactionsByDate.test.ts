import { describe, expect, it } from 'vitest';
import { sortTransactionsByDate } from '../src';

type TestTransaction = {
  id: string;
  createdAt?: string | Date | null;
};

describe('sortTransactionsByDate', () => {
  const oldest: TestTransaction = {
    id: 'oldest',
    createdAt: '2024-01-01T00:00:00Z',
  };
  const middle: TestTransaction = {
    id: 'middle',
    createdAt: '2024-02-01T00:00:00Z',
  };
  const newest: TestTransaction = {
    id: 'newest',
    createdAt: '2024-03-01T00:00:00Z',
  };

  it('sorts newest-first by default', () => {
    expect(sortTransactionsByDate([oldest, newest, middle])).toEqual([
      newest,
      middle,
      oldest,
    ]);
  });

  it('sorts oldest-first when requested', () => {
    expect(sortTransactionsByDate([middle, newest, oldest], 'oldest')).toEqual([
      oldest,
      middle,
      newest,
    ]);
  });

  it('supports Date values', () => {
    const asDate: TestTransaction = {
      id: 'date-object',
      createdAt: new Date('2024-04-01T00:00:00Z'),
    };

    expect(sortTransactionsByDate([oldest, asDate])).toEqual([asDate, oldest]);
  });

  it('places missing and invalid dates at the end in their original order', () => {
    const missing: TestTransaction = { id: 'missing' };
    const invalid: TestTransaction = { id: 'invalid', createdAt: 'not-a-date' };
    const empty: TestTransaction = { id: 'empty', createdAt: '' };

    expect(
      sortTransactionsByDate([missing, oldest, invalid, newest, empty], 'oldest')
    ).toEqual([oldest, newest, missing, invalid, empty]);
  });

  it('preserves the original order for equal timestamps', () => {
    const first: TestTransaction = {
      id: 'first',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const second: TestTransaction = {
      id: 'second',
      createdAt: '2024-01-01T00:00:00Z',
    };

    expect(sortTransactionsByDate([first, second])).toEqual([first, second]);
  });

  it('does not mutate the input array', () => {
    const input = [oldest, newest, middle];
    const snapshot = [...input];

    const result = sortTransactionsByDate(input);

    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
  });

  it('rejects unsupported runtime order values', () => {
    expect(() =>
      sortTransactionsByDate([oldest], 'sideways' as 'newest')
    ).toThrow(RangeError);
  });
});
