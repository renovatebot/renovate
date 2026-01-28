import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../memory/index.ts';
import * as file from './file.ts';
import * as packageCache from './index.ts';
import { withCache } from './with-cache.ts';

vi.mock('./file.ts');

describe('util/cache/package/with-cache', () => {
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

  it('caches string result', async () => {
    const fn = () => getValue();

    expect(
      await withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).toBe('111');
    expect(
      await withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).toBe('111');
    expect(
      await withCache({ namespace: '_test-namespace', key: 'some-key' }, fn),
    ).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:some-key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('disables cache if cacheable is false', async () => {
    const fn = () => getValue();

    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('111');
    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('222');
    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('333');

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('forces cache if cachePrivatePackages=true', async () => {
    GlobalConfig.set({ cachePrivatePackages: true });
    const fn = () => getValue();

    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('111');
    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('111');
    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', cacheable: false },
        fn,
      ),
    ).toBe('111');

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: '111' },
      30,
    );
  });

  it('caches null values', async () => {
    const fn = async (): Promise<string | null> => {
      await getValue();
      return null;
    };

    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeNull();
    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeNull();
    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeNull();

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(setCache).toHaveBeenCalledExactlyOnceWith(
      '_test-namespace',
      'cache-decorator:key',
      { cachedAt: expect.any(String), value: null },
      30,
    );
  });

  it('does not cache undefined', async () => {
    const fn = async (): Promise<string | undefined> => {
      await getValue();
      return undefined;
    };

    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeUndefined();
    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeUndefined();
    expect(
      await withCache({ namespace: '_test-namespace', key: 'key' }, fn),
    ).toBeUndefined();

    expect(getValue).toHaveBeenCalledTimes(3);
    expect(setCache).not.toHaveBeenCalled();
  });

  it('uses custom ttlMinutes', async () => {
    const fn = () => getValue();

    expect(
      await withCache(
        { namespace: '_test-namespace', key: 'key', ttlMinutes: 60 },
        fn,
      ),
    ).toBe('111');

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
      const fn = () => getValue();

      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 1000 - 1);
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(1);
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('222');
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
      const fn = () => getValue();

      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        3,
      );

      vi.advanceTimersByTime(120 * 1000 - 1);
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('222');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '222' },
        3,
      );
    });

    it('returns stale result on error', async () => {
      const fn = () => getValue();

      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(60 * 1000);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(2);
      expect(setCache).toHaveBeenCalledTimes(1);
    });

    it('drops stale value after hard TTL expires', async () => {
      const fn = () => getValue();

      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');
      expect(getValue).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenLastCalledWith(
        '_test-namespace',
        'cache-decorator:key',
        { cachedAt: expect.any(String), value: '111' },
        2,
      );

      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      getValue.mockRejectedValueOnce(new Error('test'));
      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: true,
          },
          fn,
        ),
      ).toBe('111');

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
      const fn = () => getValue();

      expect(
        await withCache(
          {
            namespace: '_test-namespace',
            key: 'key',
            ttlMinutes: 1,
            fallback: false,
          },
          fn,
        ),
      ).toBe('111');
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
