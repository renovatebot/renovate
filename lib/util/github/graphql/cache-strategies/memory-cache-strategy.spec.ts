import { DateTime, Settings } from 'luxon';
import * as memCache from '../../../cache/memory';
import { clone } from '../../../clone';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { GithubGraphqlMemoryCacheStrategy } from './memory-cache-strategy';

// const isoTs = (t: string) => DateTime.fromJSDate(new Date(t)).toISO()!;

const hourMinRe = /T\d{2}:\d{2}$/;
const hourMinSecRe = /T\d{2}:\d{2}:\d{2}$/;
const hourMinSecMillisRe = /T\d{2}:\d{2}:\d{2}\.\d\d\d$/;

const isoTs = (t: string) => {
  let iso = t.replace(' ', 'T');
  if (hourMinSecMillisRe.test(iso)) {
    iso = iso + 'Z';
  } else if (hourMinSecRe.test(iso)) {
    iso = iso + '.000Z';
  } else if (hourMinRe.test(iso)) {
    iso = iso + ':00.000Z';
  } else {
    throw new Error('Unrecognized date-time string. ' + t);
  }
  return iso;
};

const mockTime = (input: string): void => {
  const now = DateTime.fromISO(isoTs(input)).valueOf();
  Settings.now = () => now;
};

type CacheRecord = GithubGraphqlCacheRecord<GithubDatasourceItem>;

describe('util/github/graphql/cache-strategies/memory-cache-strategy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memCache.init();
  });

  it('resets old cache', async () => {
    const items = {
      '1': { version: '1', releaseTimestamp: isoTs('2020-01-01 10:00') },
    };
    const cacheRecord: CacheRecord = {
      items,
      createdAt: isoTs('2022-10-01 15:30'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    // At this moment, cache is valid
    let now = '2022-10-31 15:29:59';
    mockTime(now);

    let strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    let isPaginationDone = await strategy.reconcile([items['1']]);
    let res = await strategy.finalize();

    expect(res).toEqual(Object.values(items));
    expect(isPaginationDone).toBe(true);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual(cacheRecord);

    // One second later, the cache is invalid
    now = '2022-10-31 15:30:00';
    mockTime(now);

    strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    isPaginationDone = await strategy.reconcile([]);
    res = await strategy.finalize();

    expect(res).toEqual([]);
    expect(isPaginationDone).toBe(false);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {},
      createdAt: isoTs(now),
    });
  });

  it('reconciles old cache record with new items', async () => {
    const oldItems = {
      '1': { version: '1', releaseTimestamp: isoTs('2020-01-01 10:00') },
      '2': { version: '2', releaseTimestamp: isoTs('2020-01-01 11:00') },
      '3': { version: '3', releaseTimestamp: isoTs('2020-01-01 12:00') },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: isoTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const newItem = {
      version: '4',
      releaseTimestamp: isoTs('2022-10-15 18:00'),
    };
    const page = [newItem];

    const strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);
    const res = await strategy.finalize();

    expect(res).toEqual([...Object.values(oldItems), newItem]);
    expect(isPaginationDone).toBe(false);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {
        ...oldItems,
        '4': newItem,
      },
      createdAt: isoTs('2022-10-30 12:00'),
    });
  });

  it('signals to stop pagination', async () => {
    const oldItems = {
      '1': { releaseTimestamp: isoTs('2020-01-01 10:00'), version: '1' },
      '2': { releaseTimestamp: isoTs('2020-01-01 11:00'), version: '2' },
      '3': { releaseTimestamp: isoTs('2020-01-01 12:00'), version: '3' },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: isoTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const page = [
      ...Object.values(oldItems),
      { version: '4', releaseTimestamp: isoTs('2022-10-15 18:00') },
    ].reverse();

    const strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);

    expect(isPaginationDone).toBe(true);
  });

  it('reconciles entire page', async () => {
    const oldItems = {
      '1': { releaseTimestamp: isoTs('2020-01-01 00:00'), version: '1' },
      '2': { releaseTimestamp: isoTs('2020-01-01 01:00'), version: '2' },
      '3': { releaseTimestamp: isoTs('2020-01-01 02:00'), version: '3' },
    };
    const cacheRecord: CacheRecord = {
      items: oldItems,
      createdAt: isoTs('2022-12-31 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-12-31 23:59';
    mockTime(now);

    const page = [
      { version: '1', releaseTimestamp: isoTs('2022-12-31 10:00') },
      { version: '2', releaseTimestamp: isoTs('2022-12-31 11:00') },
      { version: '3', releaseTimestamp: isoTs('2022-12-31 12:00') },
      { version: '4', releaseTimestamp: isoTs('2022-12-31 13:00') },
    ].reverse();

    const strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);

    expect(isPaginationDone).toBe(true);
    expect(memCache.get('github-graphql-cache:foo:bar')).toMatchObject({
      items: {
        '1': { releaseTimestamp: isoTs('2022-12-31 10:00') },
        '2': { releaseTimestamp: isoTs('2022-12-31 11:00') },
        '3': { releaseTimestamp: isoTs('2022-12-31 12:00') },
        '4': { releaseTimestamp: isoTs('2022-12-31 13:00') },
      },
    });
  });

  it('detects removed packages', async () => {
    const items = {
      // stabilized
      '0': { version: '0', releaseTimestamp: isoTs('2022-09-30 10:00') }, // to be preserved
      '1': { version: '1', releaseTimestamp: isoTs('2022-10-01 10:00') }, // to be preserved
      // not stabilized
      '2': { version: '2', releaseTimestamp: isoTs('2022-10-02 10:00') },
      '3': { version: '3', releaseTimestamp: isoTs('2022-10-03 10:00') }, // to be deleted
      '4': { version: '4', releaseTimestamp: isoTs('2022-10-04 10:00') },
      '5': { version: '5', releaseTimestamp: isoTs('2022-10-05 10:00') }, // to be deleted
      '6': { version: '6', releaseTimestamp: isoTs('2022-10-06 10:00') },
      '7': { version: '7', releaseTimestamp: isoTs('2022-10-07 10:00') }, // to be deleted
      '8': { version: '8', releaseTimestamp: isoTs('2022-10-08 10:00') },
    };
    const cacheRecord: CacheRecord = {
      items,
      createdAt: isoTs('2022-10-30 12:00'),
    };
    memCache.set('github-graphql-cache:foo:bar', clone(cacheRecord));

    const now = '2022-10-31 15:30';
    mockTime(now);

    const page = [
      items['1'],
      items['2'],
      items['4'],
      items['6'],
      items['8'],
    ].reverse();

    const strategy = new GithubGraphqlMemoryCacheStrategy('foo', 'bar');
    const isPaginationDone = await strategy.reconcile(page);
    const res = await strategy.finalize();

    expect(res).toEqual([
      { version: '0', releaseTimestamp: isoTs('2022-09-30 10:00') },
      { version: '1', releaseTimestamp: isoTs('2022-10-01 10:00') },
      { version: '2', releaseTimestamp: isoTs('2022-10-02 10:00') },
      { version: '4', releaseTimestamp: isoTs('2022-10-04 10:00') },
      { version: '6', releaseTimestamp: isoTs('2022-10-06 10:00') },
      { version: '8', releaseTimestamp: isoTs('2022-10-08 10:00') },
    ]);
    expect(isPaginationDone).toBe(true);
    expect(memCache.get('github-graphql-cache:foo:bar')).toEqual({
      items: {
        '0': { version: '0', releaseTimestamp: isoTs('2022-09-30 10:00') },
        '1': { version: '1', releaseTimestamp: isoTs('2022-10-01 10:00') },
        '2': { version: '2', releaseTimestamp: isoTs('2022-10-02 10:00') },
        '4': { version: '4', releaseTimestamp: isoTs('2022-10-04 10:00') },
        '6': { version: '6', releaseTimestamp: isoTs('2022-10-06 10:00') },
        '8': { version: '8', releaseTimestamp: isoTs('2022-10-08 10:00') },
      },
      createdAt: isoTs('2022-10-30 12:00'),
    });
  });
});
