import { DateTime, Settings } from 'luxon';
import * as packageCache from '../../../cache/package';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlPackageCacheStrategy } from './package-cache-strategy';

const isoTs = (t: string) => t.replace(' ', 'T') + ':00.000Z';

const mockTime = (input: string): void => {
  const now = DateTime.fromISO(isoTs(input)).valueOf();
  Settings.now = () => now;
};

type CacheRecord = GithubGraphqlCacheRecord<GithubDatasourceItem>;

describe('util/github/graphql/cache-strategies/package-cache-strategy', () => {
  const cacheGet = jest.spyOn(packageCache, 'get');
  const cacheSet = jest.spyOn(packageCache, 'set');

  it('reconciles old cache record with new items', async () => {
    const item1 = { version: '1', releaseTimestamp: isoTs('2020-01-01 10:00') };
    const item2 = { version: '2', releaseTimestamp: isoTs('2020-01-01 11:00') };
    const item3 = { version: '3', releaseTimestamp: isoTs('2020-01-01 12:00') };

    const oldItems = {
      '1': item1,
      '2': item2,
      '3': item3,
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: isoTs('2022-10-15 12:00'),
    };
    cacheGet.mockResolvedValueOnce(clone(cacheRecord));

    const now = '2022-10-30 12:00';
    mockTime(now);

    const updatedItem = {
      ...item3,
      releaseTimestamp: isoTs('2020-01-01 12:30'),
    };
    const newItem = {
      version: '4',
      releaseTimestamp: isoTs('2022-10-15 18:00'),
    };
    const page = [newItem, updatedItem];

    const strategy = new GithubGraphqlPackageCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);
    const res = await strategy.finalize();

    expect(res).toEqual([item1, item2, updatedItem, newItem]);
    expect(isPaginationDone).toBe(true);
    expect(cacheSet.mock.calls).toEqual([
      [
        'foo',
        'bar',
        {
          items: {
            '1': item1,
            '2': item2,
            '3': updatedItem,
            '4': newItem,
          },
          createdAt: isoTs('2022-10-15 12:00'),
        },
        15 * 24 * 60,
      ],
    ]);
  });
});
