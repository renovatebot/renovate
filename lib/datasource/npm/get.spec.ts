import * as httpMock from '../../../test/http-mock';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as hostRules from '../../util/host-rules';
import { Http } from '../../util/http';
import { getDependency, resetMemCache } from './get';
import { setNpmrc } from './npmrc';

function getPath(s = ''): string {
  const [x] = s.split('\n');
  const prePath = x.replace(/^.*https:\/\/test\.org/, '');
  return `${prePath}/@myco%2Ftest`;
}

const http = new Http('npm');

describe('datasource/npm/get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMemCache();
    hostRules.clear();
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
      await getDependency(http, '@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBe('Bearer XXX');
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
      await getDependency(http, '@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBe('Basic dGVzdDp0ZXN0');
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
      await getDependency(http, '@myco/test');

      const trace = httpMock.getTrace();
      expect(trace[0].headers.authorization).toBeUndefined();
      expect(trace).toMatchSnapshot();
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
    await getDependency(http, '@myco/test');
    expect(httpMock.getTrace()).toMatchSnapshot();
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
    await getDependency(http, 'renovate');
    expect(httpMock.getTrace()).toMatchSnapshot();
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
    await getDependency(http, 'renovate');
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('cover all paths', async () => {
    expect.assertions(10);

    setNpmrc('registry=https://test.org\n_authToken=XXX');

    httpMock
      .scope('https://test.org')
      .get('/none')
      .reply(200, { name: '@myco/test' });
    expect(await getDependency(http, 'none')).toBeNull();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest')
      .reply(200, {
        name: '@myco/test',
        repository: {},
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    expect(await getDependency(http, '@myco/test')).toBeDefined();

    httpMock
      .scope('https://test.org')
      .get('/@myco%2Ftest2')
      .reply(200, {
        name: '@myco/test2',
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' },
      });
    expect(await getDependency(http, '@myco/test2')).toBeDefined();

    httpMock.scope('https://test.org').get('/error-401').reply(401);
    expect(await getDependency(http, 'error-401')).toBeNull();

    httpMock.scope('https://test.org').get('/error-402').reply(402);
    expect(await getDependency(http, 'error-402')).toBeNull();

    httpMock.scope('https://test.org').get('/error-404').reply(404);
    expect(await getDependency(http, 'error-404')).toBeNull();

    httpMock.scope('https://test.org').get('/error4').reply(200, null);
    expect(await getDependency(http, 'error4')).toBeNull();

    setNpmrc();
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-parse-error')
      .reply(200, 'not-a-json');
    await expect(getDependency(http, 'npm-parse-error')).rejects.toThrow(
      ExternalHostError
    );

    httpMock
      .scope('https://registry.npmjs.org')
      .get('/npm-error-402')
      .reply(402);
    expect(await getDependency(http, 'npm-error-402')).toBeNull();

    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('massages non-compliant repository urls', async () => {
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
        'dist-tags': { latest: '1.0.0' },
      });

    const dep = await getDependency(http, '@neutrinojs/react');

    expect(dep.sourceUrl).toBe('https://github.com/neutrinojs/neutrino');
    expect(dep.sourceDirectory).toBe('packages/react');

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      Array [
        Object {
          "headers": Object {
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
          },
        },
        'dist-tags': { latest: '2.0.0' },
      });

    const dep = await getDependency(http, 'vue');

    expect(dep.sourceUrl).toBe('https://github.com/vuejs/vue.git');
    expect(dep.releases[0].sourceUrl).toBeUndefined();
    expect(dep.releases[1].sourceUrl).toBe(
      'https://github.com/vuejs/vue-next.git'
    );
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

    const dep = await getDependency(http, '@neutrinojs/react');

    expect(dep.sourceUrl).toBe('https://github.com/neutrinojs/neutrino');
    expect(dep.sourceDirectory).toBe('packages/foo');

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      Array [
        Object {
          "headers": Object {
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

    const dep = await getDependency(http, '@neutrinojs/react');

    expect(dep.sourceUrl).toBe(
      'https://bitbucket.org/neutrinojs/neutrino/tree/master/packages/react'
    );
    expect(dep.sourceDirectory).toBeUndefined();

    expect(httpMock.getTrace()).toMatchInlineSnapshot(`
      Array [
        Object {
          "headers": Object {
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
});
