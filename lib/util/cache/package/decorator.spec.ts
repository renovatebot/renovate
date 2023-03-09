import os from 'os';
import { mock } from 'jest-mock-extended';
import type { GetReleasesConfig } from '../../../modules/datasource';
import * as memCache from '../memory';
import { cache } from './decorator';
import * as packageCache from '.';

jest.mock('./file');

describe('util/cache/package/decorator', () => {
  const spy = jest.fn(() => Promise.resolve());

  beforeEach(async () => {
    memCache.init();
    await packageCache.init({ cacheDir: os.tmpdir() });
  });

  it('should cache string', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: 'key' })
      public async getNumber(): Promise<number> {
        await spy();
        return Math.random();
      }
    }
    const myClass = new MyClass();
    expect(await myClass.getNumber()).toEqual(await myClass.getNumber());
    expect(await myClass.getNumber()).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Do not cache', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: 'key', cacheable: () => false })
      public async getString(
        cacheKey: string,
        test: string | null
      ): Promise<string | null> {
        await spy();
        return test;
      }
    }
    const myClass = new MyClass();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('test', 'test')).toBe('test');
    expect(await myClass.getString('test', 'test')).toBe('test');
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('Do cache null', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: (cacheKey, test) => cacheKey })
      public async getString(
        cacheKey: string,
        test: string | null
      ): Promise<string | null> {
        await spy();
        return test;
      }
    }
    const myClass = new MyClass();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('test', 'test')).toBe('test');
    expect(await myClass.getString('test', 'test')).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Do not cache undefined', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: 'undefined' })
      public async getString(): Promise<string | undefined> {
        await spy();
        return undefined;
      }
    }
    const myClass = new MyClass();
    expect(await myClass.getString()).toBeUndefined();
    expect(await myClass.getString()).toEqual(await myClass.getString());
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('should cache function', async () => {
    class MyClass {
      @cache({
        namespace: (arg: GetReleasesConfig) => arg.registryUrl ?? 'default',
        key: () => 'key',
      })
      public async getNumber(_: GetReleasesConfig): Promise<number> {
        await spy();
        return Math.random();
      }
    }
    const myClass = new MyClass();
    const getReleasesConfig: GetReleasesConfig = {
      registryUrl: 'registry',
      ...mock<GetReleasesConfig>(),
    };
    expect(await myClass.getNumber(getReleasesConfig)).toEqual(
      await myClass.getNumber(getReleasesConfig)
    );
    expect(await myClass.getNumber(getReleasesConfig)).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('works', async () => {
    class MyClass {
      public async getNumber(): Promise<number> {
        await spy();
        return Math.random();
      }
    }
    const decorator = cache({ namespace: 'namespace', key: 'key' });
    const getNumber = decorator(
      MyClass.prototype,
      'getNumber',
      undefined as never
    );

    expect(await getNumber.value?.()).toBeNumber();
  });

  describe('Fallback', () => {
    const inc = jest.fn();

    class MyClass {
      @cache({
        namespace: (x: number) => x.toString(),
        key: () => 'key',
        ttlMinutes: 1,
      })
      public incNumber(x: number): Promise<number> {
        return inc(x);
      }
    }

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: false });
      inc.mockImplementation((x: number) => Promise.resolve(x + 1));
    });

    afterEach(() => {
      jest.useRealTimers();
      inc.mockClear();
      delete process.env.RENOVATE_CACHE_DECORATOR_MINUTES;
    });

    it('updates cached result', async () => {
      const myInst = new MyClass();

      expect(await myInst.incNumber(99)).toBe(100);

      jest.advanceTimersByTime(60 * 1000 - 1);
      expect(await myInst.incNumber(99)).toBe(100);
      expect(inc).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      expect(await myInst.incNumber(99)).toBe(100);
      expect(inc).toHaveBeenCalledTimes(2);
    });

    it('cache TTL can be overriden with RENOVATE_CACHE_DECORATOR_MINUTES', async () => {
      process.env.RENOVATE_CACHE_DECORATOR_MINUTES = '3';
      const myInst = new MyClass();

      expect(await myInst.incNumber(99)).toBe(100);

      jest.advanceTimersByTime(3 * 60 * 1000 - 1);
      expect(await myInst.incNumber(99)).toBe(100);
      expect(inc).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      expect(await myInst.incNumber(99)).toBe(100);
      expect(inc).toHaveBeenCalledTimes(2);
    });

    it('returns obsolete result on error', async () => {
      const myInst = new MyClass();

      expect(await myInst.incNumber(99)).toBe(100);

      jest.advanceTimersByTime(60 * 1000);
      inc.mockRejectedValueOnce(new Error('test'));
      expect(await myInst.incNumber(99)).toBe(100);
      expect(inc).toHaveBeenCalledTimes(2);
    });
  });
});
