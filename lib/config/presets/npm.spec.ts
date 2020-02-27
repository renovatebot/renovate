import nock from 'nock';
import * as npm from './npm';

jest.mock('registry-auth-token');
jest.mock('delay');

describe('config/presets/npm', () => {
  delete process.env.NPM_TOKEN;
  beforeEach(() => {
    jest.resetAllMocks();
    global.repoCache = {};
    global.trustLevel = 'low';
    nock.cleanAll();
    return global.renovateCache.rmAll();
  });
  afterEach(() => {
    delete process.env.RENOVATE_CACHE_NPM_MINUTES;
  });
  it('should throw if no package', async () => {
    nock('https://registry.npmjs.org')
      .get('/nopackage')
      .reply(404);
    await expect(npm.getPreset('nopackage', 'default')).rejects.toThrow(
      /dep not found/
    );
  });
  it('should throw if no renovate-config', async () => {
    const presetPackage = {
      name: 'norenovateconfig',
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
      .get('/norenovateconfig')
      .reply(200, presetPackage);
    await expect(npm.getPreset('norenovateconfig', 'default')).rejects.toThrow(
      /preset renovate-config not found/
    );
  });
  it('should throw if preset name not found', async () => {
    const presetPackage = {
      name: 'presetnamenotfound',
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
      .get('/presetnamenotfound')
      .reply(200, presetPackage);
    await expect(
      npm.getPreset('presetnamenotfound', 'missing')
    ).rejects.toThrow(/preset not found/);
  });
  it('should return preset', async () => {
    const presetPackage = {
      name: 'workingpreset',
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
        url: 'https://github.com/renovateapp/dummy.git',
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
      .get('/workingpreset')
      .reply(200, presetPackage);
    const res = await npm.getPreset('workingpreset');
    expect(res).toMatchSnapshot();
  });
});
