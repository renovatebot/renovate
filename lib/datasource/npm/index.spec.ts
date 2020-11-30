import mockDate from 'mockdate';
import nock from 'nock';
import _registryAuthToken from 'registry-auth-token';
import { getPkgReleases } from '..';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as hostRules from '../../util/host-rules';
import { id as datasource, getNpmrc, resetCache, setNpmrc } from '.';

jest.mock('registry-auth-token');
jest.mock('delay');

const registryAuthToken: jest.Mock<_registryAuthToken.NpmCredentials> = _registryAuthToken as never;
let npmResponse: any;

describe(getName(__filename), () => {
  delete process.env.NPM_TOKEN;
  beforeEach(() => {
    jest.resetAllMocks();
    global.trustLevel = 'low';
    resetCache();
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
    nock.cleanAll();
  });
  afterEach(() => {
    delete process.env.RENOVATE_CACHE_NPM_MINUTES;
    mockDate.reset();
  });
  it('should return null for no versions', async () => {
    const missingVersions = { ...npmResponse };
    missingVersions.versions = {};
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, missingVersions);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });
  it('should fetch package info from npm', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
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
    nock('https://registry.npmjs.org').get('/foobar').reply(200, pkg);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
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
    nock('https://registry.npmjs.org').get('/foobar').reply(200, pkg);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
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
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, deprecatedPackage);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res.deprecationMessage).toMatchSnapshot();
  });
  it('should handle foobar', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should reject name mismatch', async () => {
    nock('https://registry.npmjs.org')
      .get('/different')
      .reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'different' });
    expect(res).toBeNull();
  });
  it('should handle no time', async () => {
    delete npmResponse.time['0.0.2'];
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should return null if lookup fails 401', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(401);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });
  it('should return null if lookup fails', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(404);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toBeNull();
  });
  it('should throw error for unparseable', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, 'oops');
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });
  it('should throw error for 429', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(429);
    nock('https://registry.npmjs.org').get('/foobar').reply(429);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });
  it('should throw error for 5xx', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(503);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });
  it('should throw error for 408', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(408);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });
  it('should throw error for others', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(451);
    await expect(
      getPkgReleases({ datasource, depName: 'foobar' })
    ).rejects.toThrow();
  });
  it('should send an authorization header if provided', async () => {
    registryAuthToken.mockImplementation(() => ({
      type: 'Basic',
      token: '1234',
    }));
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should use NPM_TOKEN if provided', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const oldToken = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = 'some-token';
    const res = await getPkgReleases({ datasource, depName: 'foobar' });
    process.env.NPM_TOKEN = oldToken;
    expect(res).toMatchSnapshot();
  });
  it('should use host rules by hostName if provided', async () => {
    hostRules.add({
      hostType: 'npm',
      hostName: 'npm.mycustomregistry.com',
      token: 'abcde',
    });
    nock('https://npm.mycustomregistry.com')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = 'registry=https://npm.mycustomregistry.com/';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should use host rules by baseUrl if provided', async () => {
    hostRules.add({
      hostType: 'npm',
      baseUrl:
        'https://npm.mycustomregistry.com/_packaging/mycustomregistry/npm/registry/',
      token: 'abcde',
    });
    nock(
      'https://npm.mycustomregistry.com/_packaging/mycustomregistry/npm/registry'
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
    setNpmrc();
    expect(getNpmrc()).toBeNull();
  });
  it('should use default registry if missing from npmrc', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const npmrc = 'foo=bar';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should cache package info from npm', async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(200, npmResponse);
    const npmrc = '//registry.npmjs.org/:_authToken=abcdefghijklmnopqrstuvwxyz';
    const res1 = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    const res2 = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res1).not.toBeNull();
    expect(res1).toEqual(res2);
  });
  it('should fetch package info from custom registry', async () => {
    nock('https://npm.mycustomregistry.com')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc =
      'registry=https://npm.mycustomregistry.com/\n//npm.mycustomregistry.com/:_auth = ' +
      Buffer.from('abcdef').toString('base64');
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should replace any environment variable in npmrc', async () => {
    nock('https://registry.from-env.com')
      .get('/foobar')
      .reply(200, npmResponse);
    process.env.REGISTRY = 'https://registry.from-env.com';
    process.env.RENOVATE_CACHE_NPM_MINUTES = '15';
    global.trustLevel = 'high';
    // eslint-disable-next-line no-template-curly-in-string
    const npmrc = 'registry=${REGISTRY}';
    const res = await getPkgReleases({ datasource, depName: 'foobar', npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should throw error if necessary env var is not present', () => {
    global.trustLevel = 'high';
    // eslint-disable-next-line no-template-curly-in-string
    expect(() => setNpmrc('registry=${REGISTRY_MISSING}')).toThrow(
      Error('env-replace')
    );
  });
});
