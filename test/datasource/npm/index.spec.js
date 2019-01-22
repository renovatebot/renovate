const registryAuthToken = require('registry-auth-token');
const nock = require('nock');
const moment = require('moment');
const npm = require('../../../lib/datasource/npm');

jest.mock('registry-auth-token');
jest.mock('delay');

let npmResponse;

function getRelease(dependency, version) {
  return dependency.releases.find(release => release.version === version);
}

describe('api/npm', () => {
  delete process.env.NPM_TOKEN;
  beforeEach(() => {
    jest.resetAllMocks();
    global.repoCache = {};
    delete global.testNpmRetries;
    global.trustLevel = 'low';
    npm.resetCache();
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
      'dist-tags': {
        latest: '0.0.1',
      },
      time: {
        '0.0.1': '2018-05-06T07:21:53+02:00',
        '0.0.2': '2018-05-07T07:21:53+02:00',
      },
    };
    return global.renovateCache.rmAll();
  });
  it('should return null for no versions', async () => {
    const missingVersions = { ...npmResponse };
    missingVersions.versions = {};
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, missingVersions);
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, missingVersions);
    global.testNpmRetries = 1;
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toBe(null);
  });
  it('should fetch package info from npm', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(getRelease(res, '0.0.1').canBeUnpublished).toBe(false);
    expect(getRelease(res, '0.0.2').canBeUnpublished).toBe(false);
  });
  it('should throw if no package', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(404);
    await expect(npm.getPreset('foobar', 'default')).rejects.toThrow(
      /dep not found/
    );
  });
  it('should throw if no renovate-config', async () => {
    const presetPackage = {
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
      .reply(200, presetPackage);
    await expect(npm.getPreset('foobar', 'default')).rejects.toThrow(
      /preset renovate-config not found/
    );
  });
  it('should throw if no preset name not found', async () => {
    const presetPackage = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          foo: 1,
        },
        '0.0.2': {
          foo: 2,
          deprecated: 'This is deprecated',
          'renovate-config': { default: { rangeStrategy: 'auto' } },
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
      .reply(200, presetPackage);
    await expect(npm.getPreset('foobar', 'missing')).rejects.toThrow(
      /preset not found/
    );
  });
  it('should return preset', async () => {
    const presetPackage = {
      name: 'foobar',
      versions: {
        '0.0.1': {
          foo: 1,
        },
        '0.0.2': {
          foo: 2,
          deprecated: 'This is deprecated',
          'renovate-config': { default: { rangeStrategy: 'auto' } },
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
      .reply(200, presetPackage);
    const res = await npm.getPreset('foobar', 'default');
    expect(res).toMatchSnapshot();
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
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(res.deprecationMessage).toMatchSnapshot();
  });
  it('should handle purl', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should handle no time', async () => {
    delete npmResponse.time['0.0.2'];
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
    expect(getRelease(res, '0.0.1').canBeUnpublished).toBe(false);
    expect(getRelease(res, '0.0.2').canBeUnpublished).toBeUndefined();
  });
  it('should return canBeUnpublished=true', async () => {
    npmResponse.time['0.0.2'] = moment()
      .subtract(6, 'hours')
      .format();
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(getRelease(res, '0.0.1').canBeUnpublished).toBe(false);
    expect(getRelease(res, '0.0.2').canBeUnpublished).toBe(true);
  });
  it('should return null if lookup fails 401', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(401);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toBeNull();
  });
  it('should return null if lookup fails', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(404);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toBeNull();
  });
  it('should throw error for unparseable', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, 'oops');
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, 'oops');
    let e;
    try {
      global.testNpmRetries = 1;
      await npm.getPkgReleases({ fullname: 'foobar' });
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
  });
  it('should throw error for 429', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(429);
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(429);
    let e;
    try {
      global.testNpmRetries = 1;
      await npm.getPkgReleases({ fullname: 'foobar' });
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
  });
  it('should throw error for 5xx', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(503);
    let e;
    try {
      global.testNpmRetries = 0;
      await npm.getPkgReleases({ fullname: 'foobar' });
    } catch (err) {
      e = err;
    }
    expect(e.message).toBe('registry-failure');
  });
  it('should throw error for 408', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(408);
    let e;
    try {
      global.testNpmRetries = 0;
      await npm.getPkgReleases({ fullname: 'foobar' });
    } catch (err) {
      e = err;
    }
    expect(e.message).toBe('registry-failure');
  });
  it('should retry when 408 or 5xx', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(503);
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(408);
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200);
    global.testNpmRetries = 2;
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should throw error for others', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(451);
    let e;
    try {
      await npm.getPkgReleases({ fullname: 'foobar' });
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
  });
  it('should send an authorization header if provided', async () => {
    registryAuthToken.mockImplementation(() => ({
      type: 'Basic',
      token: '1234',
    }));
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toMatchSnapshot();
  });
  it('should use NPM_TOKEN if provided', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const oldToken = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = 'some-token';
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    process.env.NPM_TOKEN = oldToken;
    expect(res).toMatchSnapshot();
  });
  it('resets npmrc', () => {
    npm.setNpmrc('something=something');
    npm.setNpmrc('something=something');
    npm.setNpmrc();
  });
  it('should use default registry if missing from npmrc', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = 'foo=bar';
    const res = await npm.getPkgReleases({ fullname: 'foobar' }, { npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should cache package info from npm', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc = '//registry.npmjs.org/:_authToken=abcdefghijklmnopqrstuvwxyz';
    const res1 = await npm.getPkgReleases({ fullname: 'foobar' }, { npmrc });
    const res2 = await npm.getPkgReleases({ fullname: 'foobar' }, { npmrc });
    expect(res1).not.toBe(null);
    expect(res1).toEqual(res2);
  });
  it('should use global cache', async () => {
    const dummyValue = 'abc123';
    await global.renovateCache.set('datasource-npm', 'foobar', dummyValue, 10);
    const res = await npm.getPkgReleases({ fullname: 'foobar' });
    expect(res).toEqual(dummyValue);
  });
  it('should fetch package info from custom registry', async () => {
    nock('https://npm.mycustomregistry.com')
      .get('/foobar')
      .reply(200, npmResponse);
    const npmrc =
      'registry=https://npm.mycustomregistry.com/\n//npm.mycustomregistry.com/:_auth = ' +
      Buffer.from('abcdef').toString('base64');
    const res = await npm.getPkgReleases({ fullname: 'foobar' }, { npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should replace any environment variable in npmrc', async () => {
    nock('https://registry.from-env.com')
      .get('/foobar')
      .reply(200, npmResponse);
    process.env.REGISTRY = 'https://registry.from-env.com';
    global.trustLevel = 'high';
    // eslint-disable-next-line no-template-curly-in-string
    const npmrc = 'registry=${REGISTRY}';
    const res = await npm.getPkgReleases({ fullname: 'foobar' }, { npmrc });
    expect(res).toMatchSnapshot();
  });
  it('should throw error if necessary env var is not present', () => {
    let e;
    try {
      global.trustLevel = 'high';
      // eslint-disable-next-line no-template-curly-in-string
      npm.setNpmrc('registry=${REGISTRY_MISSING}');
    } catch (err) {
      e = err;
    }
    expect(e.message).toBe('env-replace');
  });
});
