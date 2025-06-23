import { GlobalConfig } from '../../../config/global';
import * as memCache from '../memory';
import { cache } from './decorator';
import * as file from './file';
import * as packageCache from '.';

vi.mock('./file');

describe('util/cache/package/decorator', () => {
  const setCache = file.set;
  const getValue = vi.fn();
  let count = 1;

  beforeEach(async () => {
    vi.useRealTimers();
    GlobalConfig.reset();
    memCache.init();
    await packageCache.init({ cacheDir: 'some-dir' });
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
    expect(await obj.fn()).toBe('222');
    expect(await obj.fn()).toBe('333');

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
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
    expect(setCache).toHaveBeenCalledOnce();
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

  it('does not cache undefined', async () => {
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

    expect(getValue).toHaveBeenCalledTimes(3);
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

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(2);
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

      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111');

      vi.advanceTimersByTime(1);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(obj.getReleases()).rejects.toThrow('test');
    });
  });
});
