import os from 'os';
import { mock } from 'jest-mock-extended';
import type { GetReleasesConfig } from '../../../datasource';
import * as memCache from '../memory';
import { cache } from './decorator';
import * as packageCache from '.';

jest.mock('./file');

describe('util/cache/package/decorator', () => {
  const spy = jest.fn(() => Promise.resolve());

  beforeAll(() => {
    memCache.init();
    packageCache.init({ cacheDir: os.tmpdir() });
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(await myClass.getNumber()).not.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Do cache null', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: (cacheKey, test) => cacheKey })
      public async getString(cacheKey: string, test: string): Promise<string> {
        await spy();
        return test;
      }
    }
    const myClass = new MyClass();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('null', null)).toBeNull();
    expect(await myClass.getString('test', 'test')).toEqual('test');
    expect(await myClass.getString('test', 'test')).not.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Do not cache undefined', async () => {
    class MyClass {
      @cache({ namespace: 'namespace', key: 'undefined' })
      public async getString(): Promise<string> {
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
        namespace: (arg: GetReleasesConfig) => arg.registryUrl,
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
    expect(await myClass.getNumber(getReleasesConfig)).not.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
