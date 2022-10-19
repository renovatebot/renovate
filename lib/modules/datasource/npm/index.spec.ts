import mockDate from 'mockdate';
import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { GlobalConfig } from '../../../config/global';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as hostRules from '../../../util/host-rules';
import { NpmDatasource, setNpmrc } from '.';

const datasource = NpmDatasource.id;

jest.mock('delay');

let npmResponse: any;

describe('modules/datasource/npm/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    GlobalConfig.reset();
    hostRules.clear();
    setNpmrc();
    npmResponse = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          foo: 1,
        },
        '0.0.2': {
          foo: 2,
        },
      },
      repository: {
        type: 'git',
        url: 'git://github.com/renovateapp/dummy.git',
        directory: 'src/a',
      },
      homepage: 'https://github.com/renovateapp/dummy',
      'dist-tags': {
        latest: '0.0.1',
      },
      time: {
        '0.0.1': '2018-05-06T07:21:53+02:00',
        '0.0.2': '2018-05-07T07:21:53+02:00',
      },
    };
  });

  afterEach(() => {
    delete process.env.RENOVATE_CACHE_NPM_MINUTES;
    mockDate.reset();
  });

  it('should return null for no versions', async () => {
    const missingVersions = { ...npmResponse };
    missingVersions.versions = {};
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, missingVersions);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });

  it('should fetch package info from npm', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });

  it('should parse repo url', async () => {
    const pkg = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          foo: 1,
        },
      },
      repository: {
        type: 'git',
        url: 'git:github.com/renovateapp/dummy',
      },
      'dist-tags': {
        latest: '0.0.1',
      },
      time: {
        '0.0.1': '2018-05-06T07:21:53+02:00',
      },
    };
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(200, pkg);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res?.sourceUrl).toBeDefined();
  });

  it('should parse repo url (string)', async () => {
    const pkg = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          repository: 'git:github.com/renovateapp/dummy',
        },
      },
      'dist-tags': {
        latest: '0.0.1',
      },
      time: {
        '0.0.1': '2018-05-06T07:21:53+02:00',
      },
    };
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(200, pkg);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res?.sourceUrl).toBeDefined();
  });

  it('should return deprecated', async () => {
    const deprecatedPackage = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          foo: 1,
        },
        '0.0.2': {
          foo: 2,
          deprecated: 'This is deprecated',
        },
      },
      repository: {
        type: 'git',
        url: 'git://github.com/renovateapp/dummy.git',
      },
      'dist-tags': {
        latest: '0.0.2',
      },
      time: {
        '0.0.1': '2018-05-06T07:21:53+02:00',
        '0.0.2': '2018-05-07T07:21:53+02:00',
      },
    };
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, deprecatedPackage);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res?.deprecationMessage).toMatchSnapshot();
  });

  it('should handle foobar', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });

  it('should handle no time', async () => {
    delete npmResponse.time['0.0.2'];
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });

  it('should return null if lookup fails 401', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(401);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });

  it('should return null if lookup fails', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(404);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });

  it('should throw error for unparseable', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, 'oops');
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });

  it('should throw error for 429', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(429);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });

  it('should throw error for 5xx', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(503);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('should throw error for 408', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(408);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('should throw error for others', async () => {
    httpMock.scope('https://registry.npmjs.org').get('/foobar').reply(451);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });

  it('should not send an authorization header if public package', async () => {
    httpMock
      .scope('https://registry.npmjs.org', {
        badheaders: ['authorization'],
      })
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });

  it('should send an authorization header if provided', async () => {
    httpMock
      .scope('https://registry.npmjs.org', {
        reqheaders: { authorization: 'Basic 1234' },
      })
      .get('/@foobar%2Fcore')
      .reply(200, { ...npmResponse, name: '@foobar/core' });
    const res = await getPkgReleases({
      datasource,
      depName: '@foobar/core',
      npmrc: '_auth = 1234',
    });
    expect(res).toMatchSnapshot();
  });

  it('should use host rules by hostName if provided', async () => {
    hostRules.add({
      hostType: 'npm',
      matchHost: 'npm.mycustomregistry.com',
      token: 'abc',
    });
    httpMock
      .scope('https://npm.mycustomregistry.com', {
        reqheaders: { authorization: 'Bearer abc' },
      })
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = 'registry=https://npm.mycustomregistry.com/';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });

  it('should use host rules by baseUrl if provided', async () => {
    hostRules.add({
      hostType: 'npm',
      matchHost:
        'https://npm.mycustomregistry.com/_packaging/mycustomregistry/npm/registry/',
      token: 'abc',
    });
    httpMock
      .scope(
        'https://npm.mycustomregistry.com/_packaging/mycustomregistry/npm/registry',
        {
          reqheaders: { authorization: 'Bearer abc' },
        }
      )
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc =
      'registry=https://npm.mycustomregistry.com/_packaging/mycustomregistry/npm/registry/';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });

  it('resets npmrc', () => {
    const npmrcContent = 'something=something';
    setNpmrc(npmrcContent);
    setNpmrc(npmrcContent);
    expect(setNpmrc()).toBeUndefined();
  });

  it('should use default registry if missing from npmrc', async () => {
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = 'foo=bar';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });

  it('should fetch package info from custom registry', async () => {
    httpMock
      .scope('https://npm.mycustomregistry.com', {})
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = `registry=https://npm.mycustomregistry.com/`;
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });

  it('should replace any environment variable in npmrc', async () => {
    httpMock
      .scope('https://registry.from-env.com')
      .get('/foobar')
      .reply(200, npmResponse);
    process.env.REGISTRY = 'https://registry.from-env.com';
    process.env.RENOVATE_CACHE_NPM_MINUTES = '15';
    GlobalConfig.set({ exposeAllEnv: true });

    const npmrc = 'registry=${REGISTRY}';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });

  it('should throw error if necessary env var is not present', () => {
    GlobalConfig.set({ exposeAllEnv: true });

    expect(() => setNpmrc('registry=${REGISTRY_MISSING}')).toThrow(
      Error('env-replace')
    );
  });
});
