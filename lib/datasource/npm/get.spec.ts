import got from 'got';
import { getName, partial } from '../../../test/util';
import { getDependency, resetMemCache } from './get';
import { setNpmrc } from './npmrc';
import * as _got from '../../util/got';
import { DatasourceError } from '../common';

jest.mock('../../util/got');

const api: jest.Mock<got.GotPromise<object>> = _got.api as never;

describe(getName(__filename), () => {
  function mock(body: object): void {
    api.mockResolvedValueOnce(
      partial<got.Response<object>>({ body })
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    resetMemCache();
    mock({ body: { name: '@myco/test' } });
  });

  describe('has bearer auth', () => {
    const configs = [
      `registry=https://test.org\n//test.org/:_authToken=XXX`,
      `registry=https://test.org/sub\n//test.org/:_authToken=XXX`,
      `registry=https://test.org/sub\n//test.org/sub/:_authToken=XXX`,
      `registry=https://test.org/sub\n_authToken=XXX`,
      `registry=https://test.org\n_authToken=XXX`,
      `registry=https://test.org\n_authToken=XXX`,
      `@myco:registry=https://test.org\n//test.org/:_authToken=XXX`,
    ];

    it.each(configs)('%p', async npmrc => {
      expect.assertions(1);
      setNpmrc(npmrc);
      await getDependency('@myco/test', 0);

      expect(api.mock.calls[0][1].headers.authorization).toEqual('Bearer XXX');
    });
  });

  describe('has basic auth', () => {
    const configs = [
      `registry=https://test.org\n//test.org/:_auth=dGVzdDp0ZXN0`,
      `registry=https://test.org\n//test.org/:username=test\n//test.org/:_password=dGVzdA==`,
      `registry=https://test.org/sub\n//test.org/:_auth=dGVzdDp0ZXN0`,
      `registry=https://test.org/sub\n//test.org/sub/:_auth=dGVzdDp0ZXN0`,
      `registry=https://test.org/sub\n_auth=dGVzdDp0ZXN0`,
      `registry=https://test.org\n_auth=dGVzdDp0ZXN0`,
      `registry=https://test.org\n_auth=dGVzdDp0ZXN0`,
      `@myco:registry=https://test.org\n//test.org/:_auth=dGVzdDp0ZXN0`,
      `@myco:registry=https://test.org\n_auth=dGVzdDp0ZXN0`,
    ];

    it.each(configs)('%p', async npmrc => {
      expect.assertions(1);
      setNpmrc(npmrc);
      await getDependency('@myco/test', 0);

      expect(api.mock.calls[0][1].headers.authorization).toEqual(
        'Basic dGVzdDp0ZXN0'
      );
    });
  });

  describe('no auth', () => {
    const configs = [
      `@myco:registry=https://test.org\n_authToken=XXX`,
      `@myco:registry=https://test.org\n//test.org/sub/:_authToken=XXX`,
      `@myco:registry=https://test.org\n//test.org/sub/:_auth=dGVzdDp0ZXN0`,
      `@myco:registry=https://test.org`,
      `registry=https://test.org`,
    ];

    it.each(configs)('%p', async npmrc => {
      expect.assertions(1);
      setNpmrc(npmrc);
      await getDependency('@myco/test', 0);

      expect(api.mock.calls[0][1].headers.authorization).toBeUndefined();
    });
  });

  it('cover all paths', async () => {
    expect.assertions(9);

    setNpmrc('registry=https://test.org\n_authToken=XXX');

    expect(await getDependency('none', 0)).toBeNull();

    mock({
      name: '@myco/test',
      repository: {},
      versions: { '1.0.0': {} },
      'dist-tags': { latest: '1.0.0' },
    });
    expect(await getDependency('@myco/test', 0)).toBeDefined();

    mock({
      name: '@myco/test2',
      versions: { '1.0.0': {} },
      'dist-tags': { latest: '1.0.0' },
    });
    expect(await getDependency('@myco/test2', 0)).toBeDefined();

    api.mockRejectedValueOnce({ statusCode: 401 });
    expect(await getDependency('error-401', 0)).toBeNull();
    api.mockRejectedValueOnce({ statusCode: 402 });
    expect(await getDependency('error-402', 0)).toBeNull();
    api.mockRejectedValueOnce({ statusCode: 404 });
    expect(await getDependency('error-404', 0)).toBeNull();

    api.mockRejectedValueOnce({});
    expect(await getDependency('error4', 0)).toBeNull();

    setNpmrc();
    api.mockRejectedValueOnce({ name: 'ParseError', body: 'parse-error' });
    await expect(getDependency('npm-parse-error', 0)).rejects.toThrow(
      DatasourceError
    );

    api.mockRejectedValueOnce({ statusCode: 402 });
    expect(await getDependency('npm-error-402', 0)).toBeNull();
  });
});
