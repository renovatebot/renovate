import { dir as tmpDir } from 'tmp-promise';
import { type MockInstance, expectTypeOf } from 'vitest';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../memory/index.ts';
import * as packageCache from './index.ts';
import type { CacheContext, CachedOptions } from './with-cache.ts';
import { withCache } from './with-cache.ts';

vi.unmock('../../mutex.ts');

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
    function fn(ctx: CacheContext) {
      ctx.public = true;
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

  it('caches synchronous results', async () => {
    const options = {
      namespace: '_test-namespace',
      key: 'sync',
    } as const;
    let callCount = 0;
    const result = withCache(options, (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<CacheContext>();
      expect(ctx.public).toBe(true);
      callCount += 1;
      return { version: callCount };
    });

    expectTypeOf(result).toEqualTypeOf<Promise<{ version: number }>>();
    await expect(result).resolves.toEqual({ version: 1 });
    await expect(withCache(options, () => ({ version: 99 }))).resolves.toEqual({
      version: 1,
    });
    expect(callCount).toBe(1);
  });

  it('does not cache private results', async () => {
    const options = { namespace: '_test-namespace', key: 'async' } as const;
    let callCount = 0;
    async function callback(ctx: CacheContext) {
      callCount += 1;
      const response = await Promise.resolve({
        shareable: callCount > 1,
        version: callCount,
      });
      ctx.public = response.shareable;
      return { version: response.version };
    }

    const result = withCache(options, callback);

    expectTypeOf(result).toEqualTypeOf<Promise<{ version: number }>>();
    await expect(result).resolves.toEqual({ version: 1 });
    await expect(withCache(options, callback)).resolves.toEqual({ version: 2 });
    await expect(withCache(options, callback)).resolves.toEqual({ version: 2 });
    expect(callCount).toBe(2);
  });

  it('caches thenable results', async () => {
    const options = { namespace: '_test-namespace', key: 'thenable' } as const;
    const thenable: PromiseLike<string | null> = {
      // oxlint-disable-next-line unicorn/no-thenable -- the `PromiseLike` contract requires a `then` method
      then: (onfulfilled, onrejected) =>
        Promise.resolve<string | null>(null).then(onfulfilled, onrejected),
    };

    const result = withCache(options, (ctx) => {
      ctx.public = true;
      return thenable;
    });

    expectTypeOf(result).toEqualTypeOf<Promise<string | null>>();
    await expect(result).resolves.toBeNull();
    await expect(withCache(options, () => 'fresh')).resolves.toBeNull();
  });

  it('resets context between calls', async () => {
    const options = { namespace: '_test-namespace', key: 'context' } as const;

    await expect(
      withCache(options, (ctx) => {
        ctx.public = false;
        return 'not cached';
      }),
    ).resolves.toBe('not cached');
    await expect(
      withCache(options, (ctx) => {
        expect(ctx.public).toBe(true);
        return 'cached';
      }),
    ).resolves.toBe('cached');
    await expect(withCache(options, () => 'unused')).resolves.toBe('cached');
  });

  it('skips callback on cache hit', async () => {
    const options = { namespace: '_test-namespace', key: 'warm' } as const;
    let callCount = 0;
    await withCache({ ...options, public: true }, () => 'cached');

    const result = await withCache(options, () => {
      callCount += 1;
      return 'fresh';
    });

    expect(result).toBe('cached');
    expect(callCount).toBe(0);
  });

  it('bypasses cache when public is false', async () => {
    const options = {
      namespace: '_test-namespace',
      key: 'disabled',
    } as const;
    await withCache({ ...options, public: true }, () => 'cached');

    const result = await withCache(
      { ...options, public: false },
      () => 'fresh',
    );

    expect(result).toBe('fresh');
    await expect(withCache(options, () => 'unused')).resolves.toBe('cached');
  });

  it.each`
    isPublic | override | stored
    ${true}  | ${false} | ${true}
    ${true}  | ${true}  | ${true}
    ${false} | ${false} | ${false}
    ${false} | ${true}  | ${true}
  `(
    'caches=$stored for public=$isPublic, cachePrivatePackages=$override',
    async ({ isPublic, override, stored }) => {
      GlobalConfig.set({ cachePrivatePackages: override });

      for (const mode of ['options', 'context']) {
        const options: CachedOptions = {
          namespace: '_test-namespace',
          key: mode,
        };
        if (mode === 'options') {
          options.public = isPublic;
        }

        let callCount = 0;
        async function callback(ctx: CacheContext) {
          expect(ctx.public).toBe(mode === 'options' ? isPublic : true);
          await Promise.resolve();
          ctx.public = isPublic;
          callCount += 1;
          return callCount;
        }

        await expect(withCache(options, callback)).resolves.toBe(1);
        await expect(withCache(options, callback)).resolves.toBe(
          stored ? 1 : 2,
        );
        expect(callCount).toBe(stored ? 1 : 2);
      }
    },
  );

  it('serializes callbacks for the same key', async () => {
    const options = {
      namespace: '_test-namespace',
      key: 'concurrent',
      public: true,
    } as const;
    let callCount = 0;
    async function callback() {
      callCount += 1;
      const value = callCount;
      await Promise.resolve();

      if (value === 1) {
        return undefined;
      }

      return value;
    }

    const results = await Promise.all([
      withCache(options, callback),
      withCache(options, callback),
      withCache(options, callback),
    ]);

    expect(results.toSorted()).toEqual([2, 2, undefined]);
    expect(callCount).toBe(2);
  });

  it('releases the lock after a callback error', async () => {
    const options = {
      namespace: '_test-namespace',
      key: 'error',
      public: true,
    } as const;
    const error = new Error('callback failed');

    await expect(
      withCache(options, () => {
        throw error;
      }),
    ).rejects.toBe(error);

    await expect(withCache(options, () => 'recovered')).resolves.toBe(
      'recovered',
    );
    await expect(withCache(options, () => 'unused')).resolves.toBe('recovered');
  });

  it('caches null values', async () => {
    async function fn(ctx: CacheContext): Promise<string | null> {
      ctx.public = true;
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

  it.each`
    override
    ${false}
    ${true}
  `(
    'does not cache undefined with cachePrivatePackages=$override',
    async ({ override }) => {
      GlobalConfig.set({ cachePrivatePackages: override });
      const options = {
        namespace: '_test-namespace',
        key: 'key',
        public: true,
      } as const;

      await expect(
        withCache(options, () => undefined),
      ).resolves.toBeUndefined();
      await expect(withCache(options, () => 'fresh')).resolves.toBe('fresh');
      await expect(withCache(options, () => 'unused')).resolves.toBe('fresh');
    },
  );

  it('uses custom ttlMinutes', async () => {
    function fn(ctx: CacheContext) {
      ctx.public = true;
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
      function fn(ctx: CacheContext) {
        ctx.public = true;
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
      function fn(ctx: CacheContext) {
        ctx.public = true;
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
      function fn(ctx: CacheContext) {
        ctx.public = true;
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

    it('drops stale value after hard TTL expires', async () => {
      function fn(ctx: CacheContext) {
        ctx.public = true;
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
      function fn(ctx: CacheContext) {
        ctx.public = true;
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
