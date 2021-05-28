/* eslint-disable max-classes-per-file */
/* eslint-disable class-methods-use-this */
import os from 'os';
import { mock } from 'jest-mock-extended';
import { getName } from '../../../../test/util';
import type { GetReleasesConfig } from '../../../datasource';
import * as memCache from '../memory';
import { cache } from './decorator';
import * as packageCache from '.';

jest.mock('./file');

describe(getName(), () => {
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

  it('should cache function', async () => {
    class MyClass {
      @cache({
        namespace: (arg: GetReleasesConfig) => arg.registryUrl,
        key: 'key',
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
