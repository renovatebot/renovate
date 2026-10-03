import { dir as tmpDir } from 'tmp-promise';
import type { MockInstance } from 'vitest';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../memory/index.ts';
import * as packageCache from './index.ts';
import { withCache } from './with-cache.ts';

describe('util/cache/package/with-cache', () => {
  let setCache: MockInstance<typeof packageCache.setWithRawTtl>;
  let dirResult: Awaited<ReturnType<typeof tmpDir>>;
  const getValue = vi.fn();
  let count = 1;

  beforeEach(async () => {
    vi.useRealTimers();
    GlobalConfig.reset();
    memCache.init();
    dirResult = await tmpDir({ unsafeCleanup: true });
    setCache = vi.spyOn(packageCache, 'setWithRawTtl');
    await packageCache.init({ cacheDir: dirResult.path });
    count = 1;
    getValue.mockImplementation(() => {
      const res = String(100 * count + 10 * count + count);
      count += 1;
      return Promise.resolve(res);
    });
  });

  afterEach(async () => {
    setCache.mockRestore();
    await packageCache.cleanup({});
    await dirResult.cleanup();
  });

  it('caches string result', async () => {
    function fn() {
      return getValue();
    }

    await expect(
      withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).resolves.toBe('111');
    await expect(
      withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).resolves.toBe('111');
    await expect(
      withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).resolves.toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:some-key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('shares a concurrent same-key lookup', async () => {
    const lookup = Promise.withResolvers<string>();
    getValue.mockImplementation(() => lookup.promise);

    const calls = Array.from({ length: 5 }, () =>
      withCache({ namespace: '_test-namespace', key: 'slow-key' }, getValue),
    );
    await vi.waitFor(() => expect(getValue).toHaveBeenCalledTimes(1));

    lookup.resolve('done');
    await expect(Promise.all(calls)).resolves.toEqual(Array(5).fill('done'));
    expect(setCache).toHaveBeenCalledTimes(1);
  });

  it('retries a concurrent caller after a failed lookup', async () => {
    const lookup = Promise.withResolvers<string>();
    const firstFn = vi.fn(() => lookup.promise);
    const secondFn = vi.fn(() => Promise.resolve('recovered'));
    const options = {
      namespace: '_test-namespace' as const,
      key: 'failed-key',
    };
    const first = withCache(options, firstFn);
    const second = withCache(options, secondFn);
    const resultsPromise = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(firstFn).toHaveBeenCalledTimes(1));
    const failure = new Error('lookup failed');
    lookup.reject(failure);
    await expect(resultsPromise).resolves.toEqual([
      { status: 'rejected', reason: failure },
      { status: 'fulfilled', value: 'recovered' },
    ]);
    expect(secondFn).toHaveBeenCalledTimes(1);

    await expect(withCache(options, getValue)).resolves.toBe('recovered');
    expect(getValue).not.toHaveBeenCalled();
  });

  it('retries a concurrent caller after an undefined result', async () => {
    const lookup = Promise.withResolvers<string | undefined>();
    const firstFn = vi.fn(() => lookup.promise);
    const secondFn = vi.fn(() => Promise.resolve('defined'));
    const options = {
      namespace: '_test-namespace' as const,
      key: 'undefined-key',
    };
    const first = withCache(options, firstFn);
    const second = withCache(options, secondFn);
    await vi.waitFor(() => expect(firstFn).toHaveBeenCalledTimes(1));
    lookup.resolve(undefined);
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe('defined');
    expect(secondFn).toHaveBeenCalledTimes(1);
  });

  it('retries a concurrent caller after a predicate-rejected result', async () => {
    const lookup = Promise.withResolvers<string>();
    const firstFn = vi.fn(() => lookup.promise);
    const secondFn = vi.fn(() => Promise.resolve('second'));
    const options = {
      namespace: '_test-namespace' as const,
      key: 'uncached-key',
      shouldCacheResult: () => false,
    };
    const first = withCache(options, firstFn);
    const second = withCache(options, secondFn);
    await vi.waitFor(() => expect(firstFn).toHaveBeenCalledTimes(1));
    lookup.resolve('first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(secondFn).toHaveBeenCalledTimes(1);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('evaluates different result predicates separately', async () => {
    const lookup = Promise.withResolvers<string>();
    const firstFn = vi.fn(() => lookup.promise);
    const secondFn = vi.fn(() => Promise.resolve('second'));
    const first = withCache(
      {
        namespace: '_test-namespace',
        key: 'predicate-key',
        shouldCacheResult: () => false,
      },
      firstFn,
    );
    const second = withCache(
      {
        namespace: '_test-namespace',
        key: 'predicate-key',
        shouldCacheResult: () => true,
      },
      secondFn,
    );
    lookup.resolve('first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(firstFn).toHaveBeenCalledTimes(1);
    expect(secondFn).toHaveBeenCalledTimes(1);
  });

  it('disables cache if cacheable is false', async () => {
    function fn() {
      return getValue();
    }

    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('111');
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('222');
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('333');

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('forces cache if cachePrivatePackages=true', async () => {
    GlobalConfig.set({ cachePrivatePackages: true });
    function fn() {
      return getValue();
    }

    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('111');
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('111');
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).resolves.toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('caches null values', async () => {
    async function fn(): Promise<string | null> {
      await getValue();
      return null;
    }

    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeNull();
    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeNull();
    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeNull();

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: null },
      30,
    );
  });

  it('does not cache values rejected by cacheResult predicate', async () => {
    async function fn(): Promise<string | null> {
      await getValue();
      return null;
    }
    function shouldCacheResult(value: unknown): boolean {
      return value !== null;
    }

    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', shouldCacheResult },
        fn,
      ),
    ).resolves.toBeNull();
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', shouldCacheResult },
        fn,
      ),
    ).resolves.toBeNull();
    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', shouldCacheResult },
        fn,
      ),
    ).resolves.toBeNull();

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('ignores cached values rejected by cacheResult predicate', async () => {
    async function nullFn(): Promise<string | null> {
      await getValue();
      return null;
    }
    function fn() {
      return getValue();
    }
    function cacheResult(value: unknown): boolean {
      return value !== null;
    }

    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, nullFn),
    ).resolves.toBeNull();
    await expect(
      withCache(
        {
          namespace: '_test-namespace',
          key: 'key',
          shouldCacheResult: cacheResult,
        },
        fn,
      ),
    ).resolves.toBe('222');
    await expect(
      withCache(
        {
          namespace: '_test-namespace',
          key: 'key',
          shouldCacheResult: cacheResult,
        },
        fn,
      ),
    ).resolves.toBe('222');

    expect(getValue).toHaveBeenCalledTimes(2);
    expect(setCache).toHaveBeenCalledTimes(2);
    expect(setCache).toHaveBeenLastCalledWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '222' },
      30,
    );
  });

  it('does not cache undefined', async () => {
    async function fn(): Promise<string | undefined> {
      await getValue();
      return undefined;
    }

    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeUndefined();
    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeUndefined();
    await expect(
      withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).resolves.toBeUndefined();

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('uses custom ttlMinutes', async () => {
    function fn() {
      return getValue();
    }

    await expect(
      withCache(
        { namespace: '_test-namespace', key: 'key', ttlMinutes: 60 },
        fn,
      ),
    ).resolves.toBe('111');

    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '111' },
      60,
    );
  });

  describe('fallback with hard TTL', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      GlobalConfig.set({ cacheHardTtlMinutes: 2 });
    });

    it('updates cached result after soft TTL expires', async () => {
      function fn() {
        return getValue();
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 1000 - 1);
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(1);
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        2,
      );
    });

    it('overrides soft ttl and updates result', async () => {
      GlobalConfig.set({
        cacheTtlOverride: { '_test-namespace': 2 },
        cacheHardTtlMinutes: 3,
      });
      function fn() {
        return getValue();
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        3,
      );

      vi.advanceTimersByTime(120 * 1000 - 1);
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        3,
      );
    });

    it('returns stale result on error', async () => {
      function fn() {
        return getValue();
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenCalledTimes(1);
    });

    it('does not return stale values rejected by cacheResult predicate', async () => {
      async function nullFn(): Promise<string | null> {
        await getValue();
        return null;
      }
      function fn() {
        return getValue();
      }
      function shouldCacheResult(value: unknown): boolean {
        return value !== null;
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          nullFn,
        ),
      ).resolves.toBeNull();
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
            shouldCacheResult,
          },
          fn,
        ),
      ).rejects.toThrow('test');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenCalledTimes(1);
    });

    it('drops stale value after hard TTL expires', async () => {
      function fn() {
        return getValue();
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).resolves.toBe('111');

      vi.advanceTimersByTime(1);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).rejects.toThrow('test');
    });

    it('does not use fallback when fallback=false', async () => {
      function fn() {
        return getValue();
      }

      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: false,
          },
          fn,
        ),
      ).resolves.toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      // Without fallback, hard TTL equals soft TTL
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        1,
      );

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      // Error should propagate since fallback is disabled
      await expect(
        withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: false,
          },
          fn,
        ),
      ).rejects.toThrow('test');
    });
  });
});
