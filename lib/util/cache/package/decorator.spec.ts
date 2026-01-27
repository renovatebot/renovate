import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../memory/index.ts';
import { cache } from './decorator.ts';
import * as file from './file.ts';
import * as packageCache from './index.ts';

vi.mock('./file.ts');

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

  describe('methodName determines fallback', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      GlobalConfig.set({ cacheHardTtlMinutes: 2 });
    });

    it('enables fallback for getReleases method', async () => {
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
      const obj = new Class();

      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      // Hard TTL of 2 minutes used (fallback enabled)
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      // After soft TTL (1 min), error returns stale data
      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(await obj.getReleases()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(2);
    });

    it('disables fallback for other method names', async () => {
      class Class {
        @cache({
          namespace: '_test-namespace',
          key: 'key',
          ttlMinutes: 1,
        })
        public otherMethod(): Promise<string> {
          return getValue();
        }
      }
      const obj = new Class();

      expect(await obj.otherMethod()).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      // Soft TTL of 1 minute used (fallback disabled)
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        1,
      );

      // After soft TTL, error propagates (no fallback)
      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      await expect(obj.otherMethod()).rejects.toThrow('test');
    });
  });
});
