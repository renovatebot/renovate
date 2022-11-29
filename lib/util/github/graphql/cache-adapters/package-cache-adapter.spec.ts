import { DateTime } from 'luxon';
import * as packageCache from '../../../../util/cache/package';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlPackageCacheAdapter } from './package-cache-adapter';

const makeTs = (input: string): string => {
  const dt = DateTime.fromSQL(input);
  if (!dt.isValid) {
    new Error(`Invalid date: ${input}`);
  }
  return dt.toISO();
};

const mockTime = (input: string): void => {
  jest.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromISO(makeTs(input)));
};

type CacheRecord = GithubGraphqlCacheRecord<GithubDatasourceItem>;

describe('util/github/graphql/cache-adapters/package-cache-adapter', () => {
  const cacheGet = jest.spyOn(packageCache, 'get');
  const cacheSet = jest.spyOn(packageCache, 'set');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reconciles old cache record with new items', async () => {
    const oldItems = {
      '1': { version: '1', releaseTimestamp: makeTs('2020-01-01 10:00') },
      '2': { version: '2', releaseTimestamp: makeTs('2020-01-01 11:00') },
      '3': { version: '3', releaseTimestamp: makeTs('2020-01-01 12:00') },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: makeTs('2022-10-15 12:00'),
      updatedAt: makeTs('2022-10-15 12:00'),
    };
    cacheGet.mockResolvedValueOnce(clone(cacheRecord));

    const now = '2022-10-30 12:00';
    mockTime(now);

    const newItem = {
      version: '4',
      releaseTimestamp: makeTs('2022-10-15 18:00'),
    };
    const page = [newItem];

    const adapter = new GithubGraphqlPackageCacheAdapter('foo', 'bar');
    const isPaginationDone = await adapter.reconcile(page);
    const res = await adapter.finalize();

    expect(res).toEqual([...Object.values(oldItems), newItem]);
    expect(isPaginationDone).toBe(false);
    expect(cacheSet.mock.calls).toEqual([
      [
        'foo',
        'bar',
        {
          items: {
            '1': { version: '1', releaseTimestamp: makeTs('2020-01-01 10:00') },
            '2': { version: '2', releaseTimestamp: makeTs('2020-01-01 11:00') },
            '3': { version: '3', releaseTimestamp: makeTs('2020-01-01 12:00') },
            '4': { version: '4', releaseTimestamp: makeTs('2022-10-15 18:00') },
          },
          createdAt: makeTs('2022-10-15 12:00'),
          updatedAt: makeTs('2022-10-30 12:00'),
        },
        15 * 24 * 60,
      ],
    ]);
  });
});
