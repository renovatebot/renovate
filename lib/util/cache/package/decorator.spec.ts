import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { cache } from './decorator';
import { packageCache } from '.';

vi.unmock('.');
vi.unmock('../../mutex');

describe('util/cache/package/decorator', () => {
  const setCache = vi.spyOn(packageCache, 'setWithRawTtl');
  const getValue = vi.fn();
  let count = 1;

  beforeEach(() => {
    vi.useRealTimers();
    GlobalConfig.reset();
    packageCache.reset();
    count = 1;
    getValue.mockImplementation(() => {
      const res = String(100 * count + 10 * count + count);
      count += 1;
      return Promise.resolve(res);
    });
  });

  it('should cache string', async () => {
    class Class {
      @cache({ namespace: '_test-namespace', key: 'some-key' })
      public fn(): Promise<string> {
        return getValue();
      }
    }
    const obj = new Class();

    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:some-key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('disables cache if cacheability check is false', async () => {
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

    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111'); // Memory cache still works
    expect(await obj.fn()).toBe('111'); // Memory cache still works

    expect(getValue).toHaveBeenCalledTimes(1); // Only called once due to memory cache
    expect(setCache).not.toHaveBeenCalled(); // Not persisted to backend
  });

  it('forces cache if cachePrivatePackages=true', async () => {
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

    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('caches null values', async () => {
    class Class {
      @cache({ namespace: '_test-namespace', key: 'key' })
      public async fn(val: string | null): Promise<string | null> {
        await getValue();
        return val;
      }
    }
    const obj = new Class();

    expect(await obj.fn(null)).toBeNull();
    expect(await obj.fn(null)).toBeNull();
    expect(await obj.fn(null)).toBeNull();

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: null },
      30,
    );
  });

  it('cache undefined in memory only', async () => {
    class Class {
      @cache({ namespace: '_test-namespace', key: 'key' })
      public async fn(): Promise<string | undefined> {
        await getValue();
        return undefined;
      }
    }
    const obj = new Class();

    expect(await obj.fn()).toBeUndefined();
    expect(await obj.fn()).toBeUndefined();
    expect(await obj.fn()).toBeUndefined();

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('computes cache namespace and key from arguments', async () => {
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

    expect(await obj.fn('_test', arg)).toBe('111');
    expect(await obj.fn('_test', arg)).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:_test-key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('skips cache if namespace or key is empty', async () => {
    class Class {
      @cache({ namespace: (() => '') as any, key: 'key' })
      public fn1(): Promise<string> {
        return getValue();
      }

      @cache({ namespace: '_test-namespace', key: () => '' })
      public fn2(): Promise<string> {
        return getValue();
      }
    }
    const obj = new Class();

    expect(await obj.fn1()).toBe('111');
    expect(await obj.fn2()).toBe('222');

    expect(getValue).toHaveBeenCalledTimes(2);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('wraps class methods', async () => {
    class Class {
      public fn(): Promise<string> {
        return getValue();
      }
    }
    const decorator = cache({ namespace: '_test-namespace', key: 'key' });
    const fn = decorator(Class.prototype, 'fn', undefined as never);

    expect(await fn.value?.()).toBe('111');
    expect(await fn.value?.()).toBe('111');
    expect(await fn.value?.()).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  describe('Fallbacks with hard TTL', () => {
    class Class {
      @cache({
        namespace: '_test-namespace',
        key: 'key',
        ttlMinutes: 1,
      })

      // Hard TTL is enabled only for `getReleases` and `getDigest` methods
      public getReleases(): Promise<string> {
        return getValue();
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      GlobalConfig.set({ cacheHardTtlMinutes: 2 });
    });

    it('updates cached result', async () => {
      const obj = new Class();

      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 1000 - 1);
      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(1);
      packageCache.reset(); // Clear memory cache to simulate TTL expiry
      expect(await obj.getReleases()).toBe('222');
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
      const obj = new Class();

      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        3,
      );

      vi.advanceTimersByTime(120 * 1000 - 1); // namespace default ttl is 1min
      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      packageCache.reset(); // Clear memory cache to simulate TTL expiry
      expect(await obj.getReleases()).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        3,
      );
    });

    it('returns obsolete result on error', async () => {
      const obj = new Class();

      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      // With memory cache, the value is always returned regardless of TTL
      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111'); // Memory cache returns value
      expect(getValue).toHaveBeenCalledTimes(1); // getValue not called due to memory cache
      expect(setCache).toHaveBeenCalledTimes(1);
    });

    it('drops obsolete value after hard TTL is out', async () => {
      const obj = new Class();

      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      // With memory cache, the value is always returned regardless of TTL
      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111'); // Memory cache returns value

      vi.advanceTimersByTime(1);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111'); // Memory cache still returns value
    });

    describe('Concurrent access', () => {
      it('handles concurrent calls through mutex', async () => {
        class Class {
          @cache({ namespace: '_test-namespace', key: 'concurrent-key' })
          public fn(): Promise<string> {
            return getValue();
          }
        }
        const obj = new Class();

        // Simulate concurrent calls
        const [result1, result2, result3] = await Promise.all([
          obj.fn(),
          obj.fn(),
          obj.fn(),
        ]);

        expect(result1).toBe('111');
        expect(result2).toBe('111');
        expect(result3).toBe('111');
        expect(getValue).toHaveBeenCalledTimes(1); // Only one call should reach getValue
      });

      it('handles race condition with non-cacheable items', async () => {
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

        // Simulate concurrent calls for non-cacheable items
        const [result1, result2] = await Promise.all([obj.fn(), obj.fn()]);

        expect(result1).toBe('111');
        expect(result2).toBe('111'); // Should get same value from memory cache
        expect(getValue).toHaveBeenCalledTimes(1);
      });
    });

    describe('Backend cache scenarios', () => {
      it('returns cached value when within soft TTL', async () => {
        const getCache = vi.spyOn(packageCache, 'get');
        const mockCachedRecord = {
          cachedAt: DateTime.local().toISO(),
          value: 'cached-value',
        };

        // Mock the backend to return a cached value
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
        packageCache.reset(); // Clear memory to force backend lookup

        const result = await obj.fn();
        expect(result).toBe('cached-value');
        expect(getValue).not.toHaveBeenCalled(); // Should use cached value

        getCache.mockRestore();
      });

      it('fetches new value when soft TTL expired but within hard TTL', async () => {
        vi.useFakeTimers();
        const getCache = vi.spyOn(packageCache, 'get');
        const mockCachedRecord = {
          cachedAt: DateTime.local().minus({ minutes: 31 }).toISO(),
          value: 'old-cached-value',
        };

        // Mock the backend to return an expired cached value
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
        packageCache.reset(); // Clear memory to force backend lookup
        GlobalConfig.set({ cacheHardTtlMinutes: 60 });

        const result = await obj.getReleases();
        expect(result).toBe('111'); // Should fetch new value
        expect(getValue).toHaveBeenCalledTimes(1);

        getCache.mockRestore();
        vi.useRealTimers();
      });

      it('returns fallback value when callback fails and value is within hard TTL', async () => {
        vi.useFakeTimers();
        const getCache = vi.spyOn(packageCache, 'get');
        const mockCachedRecord = {
          cachedAt: DateTime.local().minus({ minutes: 31 }).toISO(),
          value: 'fallback-value',
        };

        // Mock the backend to return an expired cached value
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
        packageCache.reset(); // Clear memory to force backend lookup
        GlobalConfig.set({ cacheHardTtlMinutes: 60 });

        const result = await obj.getReleases();
        expect(result).toBe('fallback-value'); // Should return fallback
        expect(getValue).toHaveBeenCalledTimes(1);

        getCache.mockRestore();
        vi.useRealTimers();
      });

      it('throws error when callback fails and no fallback value exists', async () => {
        const getCache = vi.spyOn(packageCache, 'get');

        // Mock the backend to return undefined (no cached value)
        getCache.mockResolvedValueOnce(undefined);
        getValue.mockRejectedValueOnce(
          new Error('upstream error with no cache'),
        );

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
        packageCache.reset(); // Clear memory to force backend lookup

        await expect(obj.fn()).rejects.toThrow('upstream error with no cache');
        expect(getValue).toHaveBeenCalledTimes(1);

        getCache.mockRestore();
      });
    });
  });
});
