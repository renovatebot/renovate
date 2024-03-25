import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as _packageCache from '../../../util/cache/package';
import * as hostRules from '../../../util/host-rules';
import { Http } from '../../../util/http';
import { CACHE_REVISION, getDependency } from './get';
import { resolveRegistryUrl, setNpmrc } from './npmrc';

jest.mock('../../../util/cache/package');

const packageCache = mocked(_packageCache);

function getPath(s = ''): string {
  const [x] = s.split('\n');
  const prePath = x.replace(/^.*https:\/\/test\.org/, '');
  return `${prePath}/@myco%2Ftest`;
}

const http = new Http('npm');

describe('modules/datasource/npm/get', () => {
  beforeEach(() => {
    hostRules.clear();
    setNpmrc();
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
      const registryUrl = resolveRegistryUrl('@myco/test');
      expect(await getDependency(http, registryUrl, '@myco/test')).toBeNull();

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBe('Bearer XXX');
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
      const registryUrl = resolveRegistryUrl('@myco/test');
      expect(await getDependency(http, registryUrl, '@myco/test')).toBeNull();

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBe('Basic dGVzdDp0ZXN0');
    });
  });

  describe('no auth', () => {
    const configs = [
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
      const registryUrl = resolveRegistryUrl('@myco/test');
      expect(await getDependency(http, registryUrl, '@myco/test')).toBeNull();

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBeUndefined();
    });
  });

  it('uses hostRules basic auth', async () => {
    expect.assertions(1);
    const npmrc = `registry=https://test.org`;
    hostRules.add({
      matchHost: 'https://test.org',
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
    const registryUrl = resolveRegistryUrl('@myco/test');
    expect(await getDependency(http, registryUrl, '@myco/test')).toBeNull();
  });

  it('uses hostRules token auth', async () => {
    expect.assertions(1);
    const npmrc = ``;
    hostRules.add({
      matchHost: 'https://registry.npmjs.org',
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
    const registryUrl = resolveRegistryUrl('renovate');
    expect(await getDependency(http, registryUrl, 'renovate')).toBeNull();
  });

  it('uses hostRules basic token auth', async () => {
    expect.assertions(1);
    const npmrc = ``;
    hostRules.add({
      matchHost: 'https://registry.npmjs.org',
      token: 'abc',
      authType: 'Basic',
    });

    httpMock
      .scope('https://registry.npmjs.org', {
        reqheaders: {
          authorization: 'Basic abc',
        },
      })
      .get('/renovate')
      .reply(200, { name: 'renovate' });
    setNpmrc(npmrc);
    const registryUrl = resolveRegistryUrl('renovate');
    expect(await getDependency(http, registryUrl, 'renovate')).toBeNull();
  });

  it('cover all paths', async () => {
    expect.assertions(9);

    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/none')
      .reply(200, { name: '@myco/test' });
    let registryUrl = resolveRegistryUrl('none');
    expect(await getDependency(http, registryUrl, 'none')).toBeNull();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest')
      .reply(200, {
        name: '@myco/test',
        repository: {},
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    registryUrl = resolveRegistryUrl('@myco/test');
    expect(await getDependency(http, registryUrl, '@myco/test')).toBeDefined();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest2')
      .reply(200, {
        name: '@myco/test2',
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    registryUrl = resolveRegistryUrl('@myco/test2');
    expect(await getDependency(http, registryUrl, '@myco/test2')).toBeDefined();

    httpMock.scope('https://test.org').get('/error-401').reply(401);
    registryUrl = resolveRegistryUrl('error-401');
    expect(await getDependency(http, registryUrl, 'error-401')).toBeNull();

    httpMock.scope('https://test.org').get('/error-402').reply(402);
    registryUrl = resolveRegistryUrl('error-402');
    expect(await getDependency(http, registryUrl, 'error-402')).toBeNull();

    httpMock.scope('https://test.org').get('/error-404').reply(404);
    registryUrl = resolveRegistryUrl('error-404');
    expect(await getDependency(http, registryUrl, 'error-404')).toBeNull();

    // return invalid json to get coverage
    httpMock.scope('https://test.org').get('/error4').reply(200, '{');
    registryUrl = resolveRegistryUrl('error4');
    expect(await getDependency(http, registryUrl, 'error4')).toBeNull();

    setNpmrc();
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    registryUrl = resolveRegistryUrl('npm-parse-error');
    await expect(
      getDependency(http, registryUrl, 'npm-parse-error'),
    ).rejects.toThrow(ExternalHostError);

    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-error-402')
      .reply(402);
    expect(await getDependency(http, registryUrl, 'npm-error-402')).toBeNull();
  });

  it('throw ExternalHostError when error happens on registry.npmjs.org', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    await expect(
      getDependency(http, registryUrl, 'npm-parse-error'),
    ).rejects.toThrow(ExternalHostError);
  });

  it('redact body for ExternalHostError when error happens on registry.npmjs.org', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    let thrownError;
    try {
      await getDependency(http, registryUrl, 'npm-parse-error');
    } catch (error) {
      thrownError = error;
    }
    expect(thrownError.err.name).toBe('ParseError');
    expect(thrownError.err.body).toBe('err.body deleted by Renovate');
  });

  it('do not throw ExternalHostError when error happens on custom host', async () => {
    setNpmrc('registry=https://test.org');
    httpMock
      .scope('https://test.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    expect(
      await getDependency(http, registryUrl, 'npm-parse-error'),
    ).toBeNull();
  });

  it('do not throw ExternalHostError when error happens on registry.npmjs.org when hostRules disables abortOnError', async () => {
    hostRules.add({
      matchHost: 'https://registry.npmjs.org',
      abortOnError: false,
    });
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    expect(
      await getDependency(http, registryUrl, 'npm-parse-error'),
    ).toBeNull();
  });

  it('do not throw ExternalHostError when error happens on registry.npmjs.org when hostRules without protocol disables abortOnError', async () => {
    hostRules.add({
      matchHost: 'registry.npmjs.org',
      abortOnError: false,
    });
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    expect(
      await getDependency(http, registryUrl, 'npm-parse-error'),
    ).toBeNull();
  });

  it('throw ExternalHostError when error happens on custom host when hostRules enables abortOnError', async () => {
    setNpmrc('registry=https://test.org');
    hostRules.add({
      matchHost: 'https://test.org',
      abortOnError: true,
    });
    httpMock
      .scope('https://test.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    const registryUrl = resolveRegistryUrl('npm-parse-error');
    await expect(
      getDependency(http, registryUrl, 'npm-parse-error'),
    ).rejects.toThrow(ExternalHostError);
  });

  it('massages non-compliant repository urls', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org', {
        reqheaders: { authorization: 'Bearer XXX' },
      })
      .get('/@neutrinojs%2Freact')
      .reply(200, {
        name: '@neutrinojs/react',
        repository: {
          type: 'git',
          url: 'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
        },
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');

    expect(dep?.sourceUrl).toBe(
      'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
    );
    expect(dep?.sourceDirectory).toBeUndefined();

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      [
        {
          "headers": {
            "accept": "application/json",
            "accept-encoding": "gzip, deflate, br",
            "authorization": "Bearer XXX",
            "host": "test.org",
            "user-agent": "RenovateBot/0.0.0-semantic-release (https://github.com/renovatebot/renovate)",
          },
          "method": "GET",
          "url": "https://test.org/@neutrinojs%2Freact",
        },
      ]
    `);
  });

  it('handles missing dist-tags latest', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/@neutrinojs%2Freact')
      .reply(200, {
        name: '@neutrinojs/react',
        repository: {
          type: 'git',
          url: 'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
        },
        versions: { '1.0.0': {} },
      });
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');

    expect(dep?.sourceUrl).toBe(
      'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
    );
    expect(dep?.sourceDirectory).toBeUndefined();
  });

  it('handles mixed sourceUrls in releases', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/vue')
      .reply(200, {
        name: 'vue',
        repository: {
          type: 'git',
          url: 'https://github.com/vuejs/vue.git',
        },
        versions: {
          '2.0.0': {
            repository: {
              type: 'git',
              url: 'https://github.com/vuejs/vue.git',
            },
          },
          '3.0.0': {
            repository: {
              type: 'git',
              url: 'https://github.com/vuejs/vue-next.git',
            },
            engines: {
              node: '>= 8.9.0',
            },
          },
        },
        'dist-tags': { latest: '2.0.0' },
      });
    const registryUrl = resolveRegistryUrl('vue');
    const dep = await getDependency(http, registryUrl, 'vue');

    expect(dep?.sourceUrl).toBe('https://github.com/vuejs/vue.git');
    expect(dep?.releases[0].sourceUrl).toBeUndefined();
    expect(dep?.releases[1].sourceUrl).toBe(
      'https://github.com/vuejs/vue-next.git',
    );
  });

  it('handles short sourceUrls in releases', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/vue')
      .reply(200, {
        name: 'vue',
        repository: {
          type: 'git',
          url: 'https://github.com/vuejs/vue',
        },
        versions: {
          '2.0.0': {
            repository: 'vuejs/vue',
          },
          '3.0.0': {
            repository: 'github:vuejs/vue-next',
          },
          '4.0.0': {
            repository: 'gitlab:vuejs/vue',
          },
          '5.0.0': {
            repository: 'bitbucket:vuejs/vue',
          },
        },
        'dist-tags': { latest: '2.0.0' },
      });
    const registryUrl = resolveRegistryUrl('vue');
    const dep = await getDependency(http, registryUrl, 'vue');
    expect(dep).toMatchObject({
      sourceUrl: 'https://github.com/vuejs/vue',
      releases: [
        {},
        { sourceUrl: 'https://github.com/vuejs/vue-next' },
        { sourceUrl: 'https://gitlab.com/vuejs/vue' },
        { sourceUrl: 'https://bitbucket.org/vuejs/vue' },
      ],
    });
  });

  it('does not override sourceDirectory', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/@neutrinojs%2Freact')
      .reply(200, {
        name: '@neutrinojs/react',
        repository: {
          type: 'git',
          url: 'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
          directory: 'packages/foo',
        },
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');

    expect(dep?.sourceUrl).toBe(
      'https://github.com/neutrinojs/neutrino/tree/master/packages/react',
    );
    expect(dep?.sourceDirectory).toBe('packages/foo');

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      [
        {
          "headers": {
            "accept": "application/json",
            "accept-encoding": "gzip, deflate, br",
            "authorization": "Bearer XXX",
            "host": "test.org",
            "user-agent": "RenovateBot/0.0.0-semantic-release (https://github.com/renovatebot/renovate)",
          },
          "method": "GET",
          "url": "https://test.org/@neutrinojs%2Freact",
        },
      ]
    `);
  });

  it('does not massage non-github non-compliant repository urls', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/@neutrinojs%2Freact')
      .reply(200, {
        name: '@neutrinojs/react',
        repository: {
          type: 'git',
          url: 'https://bitbucket.org/neutrinojs/neutrino/tree/master/packages/react',
        },
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');

    expect(dep?.sourceUrl).toBe(
      'https://bitbucket.org/neutrinojs/neutrino/tree/master/packages/react',
    );
    expect(dep?.sourceDirectory).toBeUndefined();

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      [
        {
          "headers": {
            "accept": "application/json",
            "accept-encoding": "gzip, deflate, br",
            "authorization": "Bearer XXX",
            "host": "test.org",
            "user-agent": "RenovateBot/0.0.0-semantic-release (https://github.com/renovatebot/renovate)",
          },
          "method": "GET",
          "url": "https://test.org/@neutrinojs%2Freact",
        },
      ]
    `);
  });

  it('discards cache with no revision', async () => {
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    packageCache.get.mockResolvedValueOnce({
      some: 'result',
      cacheData: { softExpireAt: '2099' },
    });

    httpMock
      .scope('https://test.org')
      .get('/@neutrinojs%2Freact')
      .reply(200, {
        name: '@neutrinojs/react',
        versions: { '1.0.0': {} },
      });
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');

    expect(dep?.releases).toHaveLength(1);
  });

  it('returns unexpired cache', async () => {
    packageCache.get.mockResolvedValueOnce({
      some: 'result',
      cacheData: { revision: CACHE_REVISION, softExpireAt: '2099' },
    });
    const dep = await getDependency(http, 'https://some.url', 'some-package');
    expect(dep).toMatchObject({ some: 'result' });
  });

  it('returns soft expired cache if revalidated', async () => {
    packageCache.get.mockResolvedValueOnce({
      some: 'result',
      cacheData: {
        revision: CACHE_REVISION,
        softExpireAt: '2020',
        etag: 'some-etag',
      },
    });
    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock.scope('https://test.org').get('/@neutrinojs%2Freact').reply(304);
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');
    expect(dep).toMatchObject({ some: 'result' });
  });

  it('returns soft expired cache on npmjs error', async () => {
    packageCache.get.mockResolvedValueOnce({
      some: 'result',
      cacheData: {
        revision: CACHE_REVISION,
        softExpireAt: '2020',
        etag: 'some-etag',
      },
    });

    httpMock
      .scope('https://registry.npmjs.org')
      .get('/@neutrinojs%2Freact')
      .reply(500);
    const registryUrl = resolveRegistryUrl('@neutrinojs/react');
    const dep = await getDependency(http, registryUrl, '@neutrinojs/react');
    expect(dep).toMatchObject({ some: 'result' });
  });
});
