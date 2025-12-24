import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import type { MockInstance } from 'vitest';
import { GlobalConfig } from '../../../config/global';
import { cache } from './decorator';
import { init, packageCache } from '.';

vi.unmock('.');
vi.unmock('../../mutex');

describe('util/cache/package/decorator', () => {
  const getValue = vi.fn();
  let count = 1;
  let tmpDir: DirectoryResult;
  let setCache: MockInstance<typeof packageCache.setWithRawTtl>;

  beforeEach(async () => {
    vi.useRealTimers();
    GlobalConfig.reset();
    tmpDir = await dir({ unsafeCleanup: true });
    await init({ cacheDir: tmpDir.path });
    setCache = vi.spyOn(packageCache, 'setWithRawTtl');
    packageCache.reset();
    count = 1;
    getValue.mockImplementation(() => {
      const res = String(100 * count + 10 * count + count);
      count += 1;
      return Promise.resolve(res);
    });
  });

  afterEach(async () => {
    setCache.mockRestore();
    await tmpDir.cleanup();
  });

  describe('Basic caching behavior', () => {
    it('caches string value and returns same result on repeated calls', async () => {
      class Class {
        @cache({ namespace: '_test-namespace', key: 'some-key' })
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();

      const res1 = await obj.fn();
      const res2 = await obj.fn();
      const res3 = await obj.fn();

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(res3).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:some-key',
        { cachedAt: expect.any(String), value: '111' },
        30,
      );
    });

    it('persists and returns null values', async () => {
      class Class {
        @cache({ namespace: '_test-namespace', key: 'key' })
        public async fn(val: string | null): Promise<string | null> {
          await getValue();
          return val;
        }
      }
      const obj = new Class();

      const res1 = await obj.fn(null);
      const res2 = await obj.fn(null);
      const res3 = await obj.fn(null);

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res3).toBeNull();
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: null },
        30,
      );
    });

    it('caches undefined values in memory only, skips persistence', async () => {
      class Class {
        @cache({ namespace: '_test-namespace', key: 'key' })
        public async fn(): Promise<string | undefined> {
          await getValue();
          return undefined;
        }
      }
      const obj = new Class();

      const res1 = await obj.fn();
      const res2 = await obj.fn();
      const res3 = await obj.fn();

      expect(res1).toBeUndefined();
      expect(res2).toBeUndefined();
      expect(res3).toBeUndefined();
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).not.toHaveBeenCalled();
    });
  });

  describe('Cacheability control', () => {
    it('disables persistence when cacheability check returns false', async () => {
      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'key',
          cacheable: () => false,
        })
        public fn(): Promise<string | null> {
          return getValue();
        }
      }
      const obj = new Class();

      const res1 = await obj.fn();
      const res2 = await obj.fn();
      const res3 = await obj.fn();

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(res3).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).not.toHaveBeenCalled();
    });

    it('forces persistence when cachePrivatePackages is enabled', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });

      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'key',
          cacheable: () => false,
        })
        public fn(): Promise<string | null> {
          return getValue();
        }
      }
      const obj = new Class();

      const res1 = await obj.fn();
      const res2 = await obj.fn();
      const res3 = await obj.fn();

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(res3).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        30,
      );
    });
  });

  describe('Dynamic namespace and key computation', () => {
    it('computes namespace and key from function arguments', async () => {
      interface Arg {
        foo: 'namespace';
        bar: 'key';
      }

      class Class {
        @cache({
          namespace: (prefix: '_test', arg: Arg) => `${prefix}-${arg.foo}`,
          key: (prefix: '_test', arg: Arg) => `${prefix}-${arg.bar}`,
        })
        public fn(_prefix: '_test', _arg: Arg): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();
      const arg: Arg = { foo: 'namespace', bar: 'key' };

      const res1 = await obj.fn('_test', arg);
      const res2 = await obj.fn('_test', arg);

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:_test-key',
        { cachedAt: expect.any(String), value: '111' },
        30,
      );
    });

    it('skips caching when namespace or key is empty', async () => {
      class Class {
        @cache({ namespace: () => '' as never, key: 'key' })
        public fn1(): Promise<string> {
          return getValue();
        }

        @cache({ namespace: '_test-namespace', key: () => '' })
        public fn2(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();

      const res1 = await obj.fn1();
      const res2 = await obj.fn2();

      expect(res1).toBe('111');
      expect(res2).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).not.toHaveBeenCalled();
    });
  });

  describe('Decorator application', () => {
    it('wraps and caches class methods', async () => {
      class Class {
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const decorator = cache({ namespace: '_test-namespace', key: 'key' });
      const fn = decorator(Class.prototype, 'fn', undefined as never);

      const res1 = await fn.value?.();
      const res2 = await fn.value?.();
      const res3 = await fn.value?.();

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(res3).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        30,
      );
    });
  });

  describe('Concurrent access', () => {
    it('deduplicates concurrent calls through mutex', async () => {
      class Class {
        @cache({ namespace: '_test-namespace', key: 'concurrent-key' })
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();

      const [res1, res2, res3] = await Promise.all([
        obj.fn(),
        obj.fn(),
        obj.fn(),
      ]);

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(res3).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent calls for non-cacheable items using memory cache', async () => {
      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'race-key',
          cacheable: () => false,
        })
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();

      const [res1, res2] = await Promise.all([obj.fn(), obj.fn()]);

      expect(res1).toBe('111');
      expect(res2).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Soft and hard TTL with fallbacks', () => {
    class Class {
      @cache({
        namespace: '_test-namespace',
        key: 'key',
        ttlMinutes: 1,
      })
      public getReleases(): Promise<string> {
        return getValue();
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      GlobalConfig.set({ cacheHardTtlMinutes: 2 });
    });

    it('updates cached result after soft TTL expires', async () => {
      const obj = new Class();

      const res1 = await obj.getReleases();
      expect(res1).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 1000 - 1);
      const res2 = await obj.getReleases();
      expect(res2).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(1);
      packageCache.reset();
      const res3 = await obj.getReleases();
      expect(res3).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        2,
      );
    });

    it('respects hard TTL override and fetches new value', async () => {
      GlobalConfig.set({
        cacheTtlOverride: { '_test-namespace': 2 },
        cacheHardTtlMinutes: 3,
      });
      const obj = new Class();

      const res1 = await obj.getReleases();
      expect(res1).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        3,
      );

      vi.advanceTimersByTime(120 * 1000 - 1);
      const res2 = await obj.getReleases();
      expect(res2).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      packageCache.reset();
      const res3 = await obj.getReleases();
      expect(res3).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        3,
      );
    });

    it('returns obsolete cached value from memory on callback error', async () => {
      const obj = new Class();

      const res1 = await obj.getReleases();
      expect(res1).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      const res2 = await obj.getReleases();
      expect(res2).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);
    });

    it('discards obsolete value after hard TTL expires', async () => {
      const obj = new Class();

      const res1 = await obj.getReleases();
      expect(res1).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      getValue.mockRejectedValueOnce(new Error('test'));
      const res2 = await obj.getReleases();
      expect(res2).toBe('111');

      vi.advanceTimersByTime(1);
      getValue.mockRejectedValueOnce(new Error('test'));
      const res3 = await obj.getReleases();
      expect(res3).toBe('111');
    });
  });

  describe('Backend cache scenarios', () => {
    it('returns cached value from backend when within soft TTL', async () => {
      const getCache = vi.spyOn(packageCache, 'getUnsynced');
      const mockCachedRecord = {
        cachedAt: DateTime.local().toISO(),
        value: 'cached-value',
      };

      getCache.mockResolvedValueOnce(mockCachedRecord);

      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'backend-key',
          ttlMinutes: 30,
        })
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();
      packageCache.reset();

      const res = await obj.fn();
      expect(res).toBe('cached-value');
      expect(getValue).not.toHaveBeenCalled();

      getCache.mockRestore();
    });

    it('fetches fresh value when soft TTL expired but within hard TTL', async () => {
      vi.useFakeTimers();
      const getCache = vi.spyOn(packageCache, 'getUnsynced');
      const mockCachedRecord = {
        cachedAt: DateTime.local().minus({ minutes: 31 }).toISO(),
        value: 'old-cached-value',
      };

      getCache.mockResolvedValueOnce(mockCachedRecord);

      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'ttl-key',
          ttlMinutes: 30,
        })
        public getReleases(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();
      packageCache.reset();
      GlobalConfig.set({ cacheHardTtlMinutes: 60 });

      const res = await obj.getReleases();
      expect(res).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);

      getCache.mockRestore();
      vi.useRealTimers();
    });

    it('returns fallback value when callback fails and value within hard TTL', async () => {
      vi.useFakeTimers();
      const getCache = vi.spyOn(packageCache, 'getUnsynced');
      const mockCachedRecord = {
        cachedAt: DateTime.local().minus({ minutes: 31 }).toISO(),
        value: 'fallback-value',
      };

      getCache.mockResolvedValueOnce(mockCachedRecord);
      getValue.mockRejectedValueOnce(new Error('upstream error'));

      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'fallback-key',
          ttlMinutes: 30,
        })
        public getReleases(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();
      packageCache.reset();
      GlobalConfig.set({ cacheHardTtlMinutes: 60 });

      const res = await obj.getReleases();
      expect(res).toBe('fallback-value');
      expect(getValue).toHaveBeenCalledTimes(1);

      getCache.mockRestore();
      vi.useRealTimers();
    });

    it('throws error when callback fails and no fallback value exists', async () => {
      const getCache = vi.spyOn(packageCache, 'getUnsynced');

      getCache.mockResolvedValueOnce(undefined);
      getValue.mockRejectedValueOnce(new Error('upstream error with no cache'));

      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'no-cache-key',
          ttlMinutes: 30,
        })
        public fn(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();
      packageCache.reset();

      await expect(obj.fn()).rejects.toThrow('upstream error with no cache');
      expect(getValue).toHaveBeenCalledTimes(1);

      getCache.mockRestore();
    });
  });
});
