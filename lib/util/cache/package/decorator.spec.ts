import os from 'os';
import * as memCache from '../memory';
import { cache } from './decorator';
import * as packageCache from '.';

jest.mock('./file');

describe('util/cache/package/decorator', () => {
  const setCache = jest.spyOn(packageCache, 'set');

  let count = 1;
  const getValue = jest.fn(() => {
    const res = String(100 * count + 10 * count + count);
    count += 1;
    return Promise.resolve(res);
  });

  beforeEach(async () => {
    memCache.init();
    await packageCache.init({ cacheDir: os.tmpdir() });
    count = 1;
  });

  it('should cache string', async () => {
    class Class {
      @cache({ namespace: 'some-namespace', key: 'some-key' })
      public fn(): Promise<string> {
        return getValue();
      }
    }
    const obj = new Class();

    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');
    expect(await obj.fn()).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledOnceWith(
      'some-namespace',
      'cache-decorator:some-key',
      { cachedAt: expect.any(String), data: '111' },
      30
    );
  });

  it('disables cache if cacheability check is false', async () => {
    class Class {
      @cache({ namespace: 'namespace', key: 'key', cacheable: () => false })
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

  it('caches null values', async () => {
    class Class {
      @cache({ namespace: 'namespace', key: 'key' })
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
    expect(setCache).toHaveBeenCalledOnceWith(
      'namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), data: null },
      30
    );
  });

  it('does not cache undefined', async () => {
    class Class {
      @cache({ namespace: 'namespace', key: 'key' })
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
    type Arg = {
      foo: 'namespace';
      bar: 'key';
    };

    class Class {
      @cache({
        namespace: (prefix: string, arg: Arg) => `${prefix}-${arg.foo}`,
        key: (prefix: string, arg: Arg) => `${prefix}-${arg.bar}`,
      })
      public fn(_prefix: string, _arg: Arg): Promise<string> {
        return getValue();
      }
    }
    const obj = new Class();
    const arg: Arg = { foo: 'namespace', bar: 'key' };

    expect(await obj.fn('some', arg)).toBe('111');
    expect(await obj.fn('some', arg)).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledOnceWith(
      'some-namespace',
      'cache-decorator:some-key',
      { cachedAt: expect.any(String), data: '111' },
      30
    );
  });

  it('wraps class methods', async () => {
    class Class {
      public fn(): Promise<string> {
        return getValue();
      }
    }
    const decorator = cache({ namespace: 'namespace', key: 'key' });
    const fn = decorator(Class.prototype, 'fn', undefined as never);

    expect(await fn.value?.()).toBe('111');
    expect(await fn.value?.()).toBe('111');
    expect(await fn.value?.()).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledOnceWith(
      'namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), data: '111' },
      30
    );
  });

  describe('Fallback', () => {
    class Class {
      @cache({
        namespace: 'namespace',
        key: 'key',
        ttlMinutes: 1,
      })
      public fn(): Promise<string> {
        return getValue();
      }
    }

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: false });
    });

    afterEach(() => {
      jest.useRealTimers();
      delete process.env.RENOVATE_CACHE_DECORATOR_MINUTES;
    });

    it('updates cached result', async () => {
      const obj = new Class();

      expect(await obj.fn()).toBe('111');

      jest.advanceTimersByTime(60 * 1000 - 1);
      expect(await obj.fn()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        'namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), data: '111' },
        1
      );

      jest.advanceTimersByTime(1);
      expect(await obj.fn()).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        'namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), data: '222' },
        1
      );
    });

    it('cache TTL can be overriden with RENOVATE_CACHE_DECORATOR_MINUTES', async () => {
      process.env.RENOVATE_CACHE_DECORATOR_MINUTES = '3';
      const obj = new Class();

      expect(await obj.fn()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        'namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), data: '111' },
        3
      );

      jest.advanceTimersByTime(3 * 60 * 1000 - 1);
      expect(await obj.fn()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      expect(await obj.fn()).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        'namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), data: '222' },
        3
      );
    });

    it('returns obsolete result on error', async () => {
      const obj = new Class();

      expect(await obj.fn()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        'namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), data: '111' },
        1
      );

      jest.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.fn()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenCalledTimes(1);
    });
  });
});
