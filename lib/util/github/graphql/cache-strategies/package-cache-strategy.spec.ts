import { DateTime, Settings } from 'luxon';
import * as packageCache from '../../../cache/package';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlPackageCacheStrategy } from './package-cache-strategy';

const isoTs = (t: string) => DateTime.fromJSDate(new Date(t)).toISO();

const mockTime = (input: string): void => {
  const now = DateTime.fromISO(isoTs(input)).valueOf();
  Settings.now = () => now;
};

type CacheRecord = GithubGraphqlCacheRecord<GithubDatasourceItem>;

describe('util/github/graphql/cache-strategies/package-cache-strategy', () => {
  const cacheGet = jest.spyOn(packageCache, 'get');
  const cacheSet = jest.spyOn(packageCache, 'set');

  it('reconciles old cache record with new items', async () => {
    const oldItems = {
      '1': { version: '1', releaseTimestamp: isoTs('2020-01-01 10:00') },
      '2': { version: '2', releaseTimestamp: isoTs('2020-01-01 11:00') },
      '3': { version: '3', releaseTimestamp: isoTs('2020-01-01 12:00') },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: isoTs('2022-10-15 12:00'),
      updatedAt: isoTs('2022-10-15 12:00'),
    };
    cacheGet.mockResolvedValueOnce(clone(cacheRecord));

    const now = '2022-10-30 12:00';
    mockTime(now);

    const newItem = {
      version: '4',
      releaseTimestamp: isoTs('2022-10-15 18:00'),
    };
    const page = [newItem];

    const strategy = new GithubGraphqlPackageCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);
    const res = await strategy.finalize();

    expect(res).toEqual([...Object.values(oldItems), newItem]);
    expect(isPaginationDone).toBe(false);
    expect(cacheSet.mock.calls).toEqual([
      [
        'foo',
        'bar',
        {
          items: {
            '1': { version: '1', releaseTimestamp: isoTs('2020-01-01 10:00') },
            '2': { version: '2', releaseTimestamp: isoTs('2020-01-01 11:00') },
            '3': { version: '3', releaseTimestamp: isoTs('2020-01-01 12:00') },
            '4': { version: '4', releaseTimestamp: isoTs('2022-10-15 18:00') },
          },
          createdAt: isoTs('2022-10-15 12:00'),
          updatedAt: isoTs('2022-10-30 12:00'),
        },
        15 * 24 * 60,
      ],
    ]);
  });
});
