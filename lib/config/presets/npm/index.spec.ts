import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { HOST_BLOCKED } from '../../../constants/error-messages.ts';
import { defaultRegistryUrl } from '../../../modules/datasource/npm/common.ts';
import { setNpmrc } from '../../../modules/datasource/npm/npmrc.ts';
import { GlobalConfig } from '../../global.ts';
import * as npm from './index.ts';

describe('config/presets/npm/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    setNpmrc();
  });

  it('should throw if no package', async () => {
    httpMock.scope(defaultRegistryUrl).get('/nopackage').reply(404);
    await expect(
      npm.getPreset({ repo: 'nopackage', presetName: 'default' }),
    ).rejects.toThrow(/dep not found/);
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
    httpMock
      .scope(defaultRegistryUrl)
      .get('/norenovateconfig')
      .reply(200, presetPackage);
    await expect(
      npm.getPreset({ repo: 'norenovateconfig', presetName: 'default' }),
    ).rejects.toThrow(/preset renovate-config not found/);
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
    httpMock
      .scope(defaultRegistryUrl)
      .get('/presetnamenotfound')
      .reply(200, presetPackage);
    await expect(
      npm.getPreset({
        repo: 'presetnamenotfound',
        presetName: 'missing',
      }),
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
    httpMock
      .scope(defaultRegistryUrl)
      .get('/workingpreset')
      .reply(200, presetPackage);
    const res = await npm.getPreset({ repo: 'workingpreset' });
    expect(res).toEqual({ rangeStrategy: 'auto' });
  });

  describe('internal registry hosts', () => {
    const presetPackage = {
      name: 'internalpreset',
      versions: {
        '0.0.1': {
          'renovate-config': { default: { rangeStrategy: 'auto' } },
        },
      },
      'dist-tags': { latest: '0.0.1' },
    };

    beforeEach(() => {
      GlobalConfig.set({ internalHostAccess: 'block' });
      // the repository's own `npmrc` picks the registry, so this is a repo-controlled URL
      setNpmrc('registry=http://10.1.2.3/');
    });

    it('is blocked when the admin only named the registry host', async () => {
      hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });

      await expect(npm.getPreset({ repo: 'internalpreset' })).rejects.toThrow(
        HOST_BLOCKED,
      );
    });

    it('is fetched under a scoped grant', async () => {
      hostRules.add(
        { hostType: 'npm', matchHost: '10.1.2.3', allowInternal: true },
        { trusted: true },
      );
      httpMock
        .scope('http://10.1.2.3')
        .get('/internalpreset')
        .reply(200, presetPackage);

      const res = await npm.getPreset({ repo: 'internalpreset' });

      expect(res).toEqual({ rangeStrategy: 'auto' });
    });
  });
});
