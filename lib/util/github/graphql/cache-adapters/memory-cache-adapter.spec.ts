import { DateTime } from 'luxon';
import * as memCache from '../../../cache/memory';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlMemoryCacheAdapter } from './memory-cache-adapter';

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

describe('util/github/graphql/cache-adapters/memory-cache-adapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memCache.init();
  });

  it('resets old cache', async () => {
    const items = {
      '1': { version: '1', releaseTimestamp: makeTs('2020-01-01 10:00') },
    };
    const cacheRecord: CacheRecord = {
      items,
      createdAt: makeTs('2022-10-01 15:30'),
      updatedAt: makeTs('2022-10-30 12:35'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    // Cache is valid
    let now = '2022-10-31 15:29:59';
    mockTime(now);

    let adapter = new GithubGraphqlMemoryCacheAdapter('foo', 'bar');
    let isPaginationDone = await adapter.reconcile([items['1']]);
    let res = await adapter.finalize();

    expect(res).toEqual(Object.values(items));
    expect(isPaginationDone).toBe(true);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      ...cacheRecord,
      updatedAt: makeTs(now),
    });

    // One second later, the cache is invalid
    now = '2022-10-31 15:30:00';
    mockTime(now);

    adapter = new GithubGraphqlMemoryCacheAdapter('foo', 'bar');
    isPaginationDone = await adapter.reconcile([]);
    res = await adapter.finalize();

    expect(res).toEqual([]);
    expect(isPaginationDone).toBe(false);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {},
      createdAt: makeTs(now),
      updatedAt: makeTs(now),
    });
  });

  it('reconciles old cache record with new items', async () => {
    const oldItems = {
      '1': { version: '1', releaseTimestamp: makeTs('2020-01-01 10:00') },
      '2': { version: '2', releaseTimestamp: makeTs('2020-01-01 11:00') },
      '3': { version: '3', releaseTimestamp: makeTs('2020-01-01 12:00') },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: makeTs('2022-10-30 12:00'),
      updatedAt: makeTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const newItem = {
      version: '4',
      releaseTimestamp: makeTs('2022-10-15 18:00'),
    };
    const page = [newItem];

    const adapter = new GithubGraphqlMemoryCacheAdapter('foo', 'bar');
    const isPaginationDone = await adapter.reconcile(page);
    const res = await adapter.finalize();

    expect(res).toEqual([...Object.values(oldItems), newItem]);
    expect(isPaginationDone).toBe(false);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {
        ...oldItems,
        '4': newItem,
      },
      createdAt: makeTs('2022-10-30 12:00'),
      updatedAt: makeTs(now),
    });
  });

  it('signals to stop pagination', async () => {
    const oldItems = {
      '1': { releaseTimestamp: makeTs('2020-01-01 10:00'), version: '1' },
      '2': { releaseTimestamp: makeTs('2020-01-01 11:00'), version: '2' },
      '3': { releaseTimestamp: makeTs('2020-01-01 12:00'), version: '3' },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: makeTs('2022-10-30 12:00'),
      updatedAt: makeTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const [knownItem] = Object.values(oldItems).reverse();
    const page = [
      { version: '4', releaseTimestamp: makeTs('2022-10-15 18:00') },
      knownItem,
    ];

    const adapter = new GithubGraphqlMemoryCacheAdapter('foo', 'bar');
    const isPaginationDone = await adapter.reconcile(page);

    expect(isPaginationDone).toBe(true);
  });

  it('detects removed packages', async () => {
    const items = {
      // stabilized
      '1': { version: '1', releaseTimestamp: makeTs('2022-10-23 10:00') }, // to be preserved
      '2': { version: '2', releaseTimestamp: makeTs('2022-10-24 10:00') },
      // not stabilized
      '3': { version: '3', releaseTimestamp: makeTs('2022-10-25 10:00') }, // to be deleted
      '4': { version: '4', releaseTimestamp: makeTs('2022-10-26 10:00') },
      '5': { version: '5', releaseTimestamp: makeTs('2022-10-27 10:00') }, // to be deleted
      '6': { version: '6', releaseTimestamp: makeTs('2022-10-28 10:00') },
      '7': { version: '7', releaseTimestamp: makeTs('2022-10-29 10:00') }, // to be deleted
      '8': { version: '8', releaseTimestamp: makeTs('2022-10-30 10:00') },
    };
    const cacheRecord: CacheRecord = {
      items,
      createdAt: makeTs('2022-10-30 12:00'),
      updatedAt: makeTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const page = [items['2'], items['4'], items['6'], items['8']];

    const adapter = new GithubGraphqlMemoryCacheAdapter('foo', 'bar');
    const isPaginationDone = await adapter.reconcile(page);
    const res = await adapter.finalize();

    expect(res).toEqual([
      { version: '1', releaseTimestamp: makeTs('2022-10-23 10:00') },
      { version: '2', releaseTimestamp: makeTs('2022-10-24 10:00') },
      { version: '4', releaseTimestamp: makeTs('2022-10-26 10:00') },
      { version: '6', releaseTimestamp: makeTs('2022-10-28 10:00') },
      { version: '8', releaseTimestamp: makeTs('2022-10-30 10:00') },
    ]);
    expect(isPaginationDone).toBe(true);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {
        '1': { version: '1', releaseTimestamp: makeTs('2022-10-23 10:00') },
        '2': { version: '2', releaseTimestamp: makeTs('2022-10-24 10:00') },
        '4': { version: '4', releaseTimestamp: makeTs('2022-10-26 10:00') },
        '6': { version: '6', releaseTimestamp: makeTs('2022-10-28 10:00') },
        '8': { version: '8', releaseTimestamp: makeTs('2022-10-30 10:00') },
      },
      createdAt: makeTs('2022-10-30 12:00'),
      updatedAt: makeTs('2022-10-31 15:30'),
    });
  });
});
