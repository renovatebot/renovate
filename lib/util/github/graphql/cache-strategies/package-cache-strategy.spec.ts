import { DateTime, Settings } from 'luxon';
import type { Timestamp } from '../../../../util/timestamp';
import * as packageCache from '../../../cache/package';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlPackageCacheStrategy } from './package-cache-strategy';

const isoTs = (t: string) => (t.replace(' ', 'T') + ':00.000Z') as Timestamp;

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

    const newItem = {
      version: '4',
      releaseTimestamp: isoTs('2022-10-15 18:00'),
    };
    const page = [newItem, item3, item2, item1];

    const strategy = new GithubGraphqlPackageCacheStrategy(
      '_test-namespace',
      'bar',
    );
    const isPaginationDone = await strategy.reconcile(page);
    const res = await strategy.finalizeAndReturn();

    expect(res).toEqual([item1, item2, item3, newItem]);
    expect(isPaginationDone).toBe(true);
    expect(cacheSet.mock.calls).toEqual([
      [
        '_test-namespace',
        'bar',
        {
          items: {
            '1': item1,
            '2': item2,
            '3': item3,
            '4': newItem,
          },
          createdAt: isoTs('2022-10-15 12:00'),
        },
        15 * 24 * 60,
      ],
    ]);
  });
});
