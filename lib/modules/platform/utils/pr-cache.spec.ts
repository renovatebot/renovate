import * as memCache from '../../../util/cache/memory/index.ts';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository/index.ts';
import { PlatformPrCache, prCacheSyncedKey } from './pr-cache.ts';
import type { BasePrCacheData } from './types.ts';

interface TestPr {
  number: number;
  title: string;
}

interface TestPrCacheData extends BasePrCacheData<TestPr> {
  updated_at: string | null;
}

const pr1: TestPr = { number: 1, title: 'one' };
const pr2: TestPr = { number: 2, title: 'two' };

class TestPrCache extends PlatformPrCache<TestPr, TestPrCacheData> {
  syncCount = 0;

  constructor(
    author: string | null,
    isOutdated?: (cache: TestPrCacheData) => boolean,
  ) {
    super({
      platform: 'local',
      author,
      createCache: () => ({ items: {}, updated_at: null, author }),
      isOutdated,
    });
  }

  protected override sync(): Promise<void> {
    this.syncCount += 1;
    this.cache.items[pr2.number] = pr2;
    this.updateItems();
    return Promise.resolve();
  }
}

describe('modules/platform/utils/pr-cache', () => {
  let cache = getCache();

  beforeEach(() => {
    memCache.init();
    repoCacheReset();
    cache = getCache();
  });

  it('creates the synced cache key', () => {
    expect(prCacheSyncedKey('gitea')).toBe('gitea-pr-cache-synced');
  });

  it('initializes a new cache', () => {
    const prCache = new TestPrCache('some-author');

    expect(prCache.getPrs()).toEqual([]);
    expect(cache.platform).toEqual({
      local: {
        pullRequestsCache: {
          items: {},
          updated_at: null,
          author: 'some-author',
        },
      },
    });
  });

  it('reuses the cache of the same author', () => {
    cache.platform = {
      local: {
        pullRequestsCache: {
          items: { '1': pr1, '2': pr2 },
          updated_at: '2020-01-01T00:00:00.000Z',
          author: 'some-author',
        },
      },
    };

    const prCache = new TestPrCache('some-author');

    expect(prCache.getPrs()).toEqual([pr2, pr1]);
  });

  it('resets the cache for not matching authors', () => {
    cache.platform = {
      local: {
        pullRequestsCache: {
          items: { '1': pr1 },
          updated_at: '2020-01-01T00:00:00.000Z',
          author: 'some-other-author',
        },
      },
    };

    const prCache = new TestPrCache('some-author');

    expect(prCache.getPrs()).toEqual([]);
  });

  it('resets the cache of an outdated format', () => {
    cache.platform = {
      local: {
        pullRequestsCache: {
          items: { '1': pr1 },
          updated_at: '2020-01-01T00:00:00.000Z',
          author: 'some-author',
        },
      },
    };

    const prCache = new TestPrCache('some-author', (data) =>
      data.updated_at!.endsWith('.000Z'),
    );

    expect(prCache.getPrs()).toEqual([]);
  });

  it('syncs once per run', async () => {
    const prCache = new TestPrCache('some-author');

    await prCache.ensureSynced();
    await prCache.ensureSynced();

    expect(prCache.syncCount).toBe(1);
    expect(prCache.getPrs()).toEqual([pr2]);
    expect(memCache.get(prCacheSyncedKey('local'))).toBeTrue();
  });

  it('skips the sync when another instance synced already', async () => {
    memCache.set(prCacheSyncedKey('local'), true);
    const prCache = new TestPrCache('some-author');

    await prCache.ensureSynced();

    expect(prCache.syncCount).toBe(0);
    expect(prCache.getPrs()).toEqual([]);
  });

  it('adds a PR to the cache', () => {
    const prCache = new TestPrCache('some-author');

    prCache.setPr(pr1);
    prCache.setPr(pr2);

    expect(prCache.getPrs()).toEqual([pr2, pr1]);
    expect(cache.platform?.local?.pullRequestsCache).toEqual({
      items: { '1': pr1, '2': pr2 },
      updated_at: null,
      author: 'some-author',
    });
  });
});
