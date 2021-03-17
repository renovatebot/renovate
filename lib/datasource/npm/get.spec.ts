import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as hostRules from '../../util/host-rules';
import { getDependency, resetMemCache } from './get';
import { setNpmrc } from './npmrc';

function getPath(s = ''): string {
  const [x] = s.split('\n');
  const prePath = x.replace(/^.*https:\/\/test\.org/, '');
  return `${prePath}/@myco%2Ftest`;
}

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMemCache();
    httpMock.setup();
    hostRules.clear();
  });

  afterEach(() => {
    httpMock.reset();
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

    it.each(configs)('%p', async (npmrc) => {
      expect.assertions(2);
      httpMock
        .scope('https://test.org', {
          reqheaders: {
            authorization: 'Bearer XXX',
          },
        })
        .get(getPath(npmrc))
        .reply(200, { name: '@myco/test' });

      setNpmrc(npmrc);
      await getDependency('@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toEqual('Bearer XXX');
      expect(trace).toMatchSnapshot();
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

    it.each(configs)('%p', async (npmrc) => {
      expect.assertions(2);
      httpMock
        .scope('https://test.org', {
          reqheaders: {
            authorization: 'Basic dGVzdDp0ZXN0',
          },
        })
        .get(getPath(npmrc))
        .reply(200, { name: '@myco/test' });
      setNpmrc(npmrc);
      await getDependency('@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toEqual('Basic dGVzdDp0ZXN0');
      expect(trace).toMatchSnapshot();
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

    it.each(configs)('%p', async (npmrc) => {
      expect.assertions(2);
      httpMock
        .scope('https://test.org', { badheaders: ['authorization'] })
        .get(getPath(npmrc))
        .reply(200, { name: '@myco/test' });
      setNpmrc(npmrc);
      await getDependency('@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBeUndefined();
      expect(trace).toMatchSnapshot();
    });
  });

  it('uses hostRules basic auth', async () => {
    expect.assertions(1);
    const npmrc = `registry=https://test.org`;
    hostRules.add({
      baseUrl: 'https://test.org',
      username: 'test',
      password: 'test',
    });

    httpMock
      .scope('https://test.org', {
        reqheaders: {
          authorization: 'Basic dGVzdDp0ZXN0',
        },
      })
      .get(getPath(npmrc))
      .reply(200, { name: '@myco/test' });
    setNpmrc(npmrc);
    await getDependency('@myco/test');
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('uses hostRules token auth', async () => {
    expect.assertions(1);
    const npmrc = ``;
    hostRules.add({
      baseUrl: 'https://registry.npmjs.org',
      token: 'XXX',
    });

    httpMock
      .scope('https://registry.npmjs.org', {
        reqheaders: {
          authorization: 'Bearer XXX',
        },
      })
      .get('/renovate')
      .reply(200, { name: 'renovate' });
    setNpmrc(npmrc);
    await getDependency('renovate');
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('uses hostRules basic token auth', async () => {
    expect.assertions(1);
    const npmrc = ``;
    hostRules.add({
      baseUrl: 'https://registry.npmjs.org',
      token: 'XXX',
      authType: 'Basic',
    });

    httpMock
      .scope('https://registry.npmjs.org', {
        reqheaders: {
          authorization: 'Basic XXX',
        },
      })
      .get('/renovate')
      .reply(200, { name: 'renovate' });
    setNpmrc(npmrc);
    await getDependency('renovate');
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('cover all paths', async () => {
    expect.assertions(10);

    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/none')
      .reply(200, { name: '@myco/test' });
    expect(await getDependency('none')).toBeNull();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest')
      .reply(200, {
        name: '@myco/test',
        repository: {},
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    expect(await getDependency('@myco/test')).toBeDefined();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest2')
      .reply(200, {
        name: '@myco/test2',
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    expect(await getDependency('@myco/test2')).toBeDefined();

    httpMock.scope('https://test.org').get('/error-401').reply(401);
    expect(await getDependency('error-401')).toBeNull();

    httpMock.scope('https://test.org').get('/error-402').reply(402);
    expect(await getDependency('error-402')).toBeNull();

    httpMock.scope('https://test.org').get('/error-404').reply(404);
    expect(await getDependency('error-404')).toBeNull();

    httpMock.scope('https://test.org').get('/error4').reply(200, null);
    expect(await getDependency('error4')).toBeNull();

    setNpmrc();
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    await expect(getDependency('npm-parse-error')).rejects.toThrow(
      ExternalHostError
    );

    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-error-402')
      .reply(402);
    expect(await getDependency('npm-error-402')).toBeNull();

    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
