import { mockDeep } from 'jest-mock-extended';
import { Fixtures } from '../../../test/fixtures';
import { mocked } from '../../../test/util';
import * as memCache from '../../util/cache/memory';
import * as _packageCache from '../../util/cache/package';
import { GlobalConfig } from '../global';
import type { RenovateConfig } from '../types';
import * as _github from './github';
import * as _local from './local';
import * as _npm from './npm';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID_JSON,
  PRESET_NOT_FOUND,
  PRESET_RENOVATE_CONFIG_NOT_FOUND,
} from './util';
import * as presets from '.';

jest.mock('./npm');
jest.mock('./github');
jest.mock('./local');
jest.mock('../../util/cache/package', () => mockDeep());

const npm = mocked(_npm);
const local = mocked(_local);
const gitHub = mocked(_github);
const packageCache = mocked(_packageCache);

const presetIkatyang = Fixtures.getJson('renovate-config-ikatyang.json');

describe('config/presets/index', () => {
  describe('resolvePreset', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = {};
      GlobalConfig.reset();
      memCache.init();
      packageCache.get.mockImplementation(
        <T>(namespace: string, key: string): Promise<T> =>
          Promise.resolve(memCache.get(`${namespace}-${key}`)),
      );

      packageCache.set.mockImplementation(
        (
          namespace: string,
          key: string,
          value: unknown,
          minutes: number,
        ): Promise<void> => {
          memCache.set(`${namespace}-${key}`, value);
          return Promise.resolve();
        },
      );

      npm.getPreset.mockImplementation(({ repo, presetName }) => {
        if (repo === 'renovate-config-ikatyang') {
          return presetIkatyang.versions[presetIkatyang['dist-tags'].latest][
            'renovate-config'
          ][presetName!];
        }
        if (repo === 'renovate-config-notfound') {
          throw new Error(PRESET_DEP_NOT_FOUND);
        }
        if (repo === 'renovate-config-noconfig') {
          throw new Error(PRESET_RENOVATE_CONFIG_NOT_FOUND);
        }
        if (repo === 'renovate-config-throw') {
          throw new Error('whoops');
        }
        if (repo === 'renovate-config-wrongpreset') {
          throw new Error(PRESET_NOT_FOUND);
        }
        return null;
      });
    });

    it('returns same if no presets', async () => {
      config.foo = 1;
      config.extends = [];
      const res = await presets.resolveConfigPresets(config);
      expect(config).toMatchObject(res);
      expect(res).toEqual({ foo: 1 });
    });

    it('throws if invalid preset file', async () => {
      config.foo = 1;
      config.extends = ['notfound'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        "Cannot find preset's package (notfound)",
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws if invalid preset', async () => {
      config.foo = 1;
      config.extends = ['wrongpreset:invalid-preset'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        'Preset name not found within published preset config (wrongpreset:invalid-preset)',
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws if path + invalid syntax', async () => {
      config.foo = 1;
      config.extends = ['github>user/repo//'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe('Preset is invalid (github>user/repo//)');
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws if path + sub-preset', async () => {
      config.foo = 1;
      config.extends = ['github>user/repo//path:subpreset'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        'Sub-presets cannot be combined with a custom path (github>user/repo//path:subpreset)',
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws if invalid preset json', async () => {
      config.foo = 1;
      config.extends = ['org/repo'];
      let e: Error | undefined;
      local.getPreset.mockRejectedValueOnce(new Error(PRESET_INVALID_JSON));
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe('Preset is invalid JSON (org/repo)');
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws noconfig', async () => {
      config.foo = 1;
      config.extends = ['noconfig:recommended'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        'Preset package is missing a renovate-config entry (noconfig:recommended)',
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('throws throw', async () => {
      config.foo = 1;
      config.extends = ['throw:base'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        'Preset caused unexpected error (throw:base)',
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('works with valid', async () => {
      config.foo = 1;
      config.ignoreDeps = [];
      config.extends = [':pinVersions'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        foo: 1,
        ignoreDeps: [],
        rangeStrategy: 'pin',
      });
      expect(res.rangeStrategy).toBe('pin');
    });

    it('throws if valid and invalid', async () => {
      config.foo = 1;
      config.extends = ['wrongpreset:invalid-preset', ':pinVersions'];
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        'Preset name not found within published preset config (wrongpreset:invalid-preset)',
      );
      expect(e!.validationMessage).toBeUndefined();
    });

    it('combines two package alls', async () => {
      config.extends = ['packages:eslint', 'packages:stylelint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        matchPackageNames: [
          '@types/eslint',
          'babel-eslint',
          '@babel/eslint-parser',
        ],
        matchPackagePrefixes: [
          '@eslint/',
          '@types/eslint__',
          '@typescript-eslint/',
          'eslint',
          'stylelint',
        ],
      });
    });

    it('resolves packageRule', async () => {
      config.packageRules = [
        {
          extends: ['packages:eslint'],
          groupName: 'eslint',
        },
      ];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        packageRules: [
          {
            groupName: 'eslint',
            matchPackageNames: [
              '@types/eslint',
              'babel-eslint',
              '@babel/eslint-parser',
            ],
            matchPackagePrefixes: [
              '@eslint/',
              '@types/eslint__',
              '@typescript-eslint/',
              'eslint',
            ],
          },
        ],
      });
    });

    it('resolves eslint', async () => {
      config.extends = ['packages:eslint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackagePrefixes).toHaveLength(4);
    });

    it('resolves linters', async () => {
      config.extends = ['packages:linters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackageNames).toHaveLength(10);
      expect(res.matchPackagePatterns).toHaveLength(1);
      expect(res.matchPackagePrefixes).toHaveLength(6);
    });

    it('resolves nested groups', async () => {
      config.extends = [':automergeLinters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      const rule = res.packageRules![0];
      expect(rule.automerge).toBeTrue();
      expect(rule.matchPackageNames).toHaveLength(10);
      expect(rule.matchPackagePatterns).toHaveLength(1);
      expect(rule.matchPackagePrefixes).toHaveLength(6);
    });

    it('migrates automerge in presets', async () => {
      config.extends = ['ikatyang:library'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.automerge).toBeUndefined();
      expect(res.minor!.automerge).toBeTrue();
    });

    it('ignores presets', async () => {
      config.extends = ['config:recommended'];
      const res = await presets.resolveConfigPresets(config, {}, [
        'config:recommended',
      ]);
      expect(config).toMatchObject(res);
      expect(res).toBeEmptyObject();
    });

    it('resolves self-hosted presets without baseConfig', async () => {
      config.extends = ['local>username/preset-repo'];
      local.getPreset.mockResolvedValueOnce({
        labels: ['self-hosted resolved'],
      });

      const res = await presets.resolveConfigPresets(config);

      expect(res.labels).toEqual(['self-hosted resolved']);
      expect(local.getPreset.mock.calls).toHaveLength(1);
      expect(res).toMatchSnapshot();
    });

    it('resolves self-hosted transitive presets without baseConfig', async () => {
      config.platform = 'gitlab';
      config.endpoint = 'https://dummy.example.com/api/v4';
      config.extends = ['local>username/preset-repo'];
      local.getPreset
        .mockResolvedValueOnce({
          extends: ['local>username/preset-repo//subpreset'],
        })
        .mockResolvedValueOnce({ labels: ['self-hosted resolved'] });

      const res = await presets.resolveConfigPresets(config);

      expect(res).toEqual({
        platform: 'gitlab',
        endpoint: 'https://dummy.example.com/api/v4',
        labels: ['self-hosted resolved'],
      });
    });

    it('gets preset value from cache when it has been seen', async () => {
      config.extends = ['github>username/preset-repo'];
      config.packageRules = [
        {
          matchManagers: ['github-actions'],
          groupName: 'github-actions dependencies',
        },
      ];
      gitHub.getPreset.mockResolvedValueOnce({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
        ],
      });

      expect(await presets.resolveConfigPresets(config)).toBeDefined();
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
          {
            matchManagers: ['github-actions'],
            groupName: 'github-actions dependencies',
          },
        ],
      });
    });

    it('default packageCache TTL should be 15 minutes', async () => {
      GlobalConfig.set({
        presetCachePersistence: true,
      });

      config.extends = ['github>username/preset-repo'];
      config.packageRules = [
        {
          matchManagers: ['github-actions'],
          groupName: 'github-actions dependencies',
        },
      ];
      gitHub.getPreset.mockResolvedValueOnce({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
        ],
      });

      expect(await presets.resolveConfigPresets(config)).toBeDefined();
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
          {
            matchManagers: ['github-actions'],
            groupName: 'github-actions dependencies',
          },
        ],
      });

      expect(packageCache.set.mock.calls[0][3]).toBe(15);
    });

    it('use packageCache when presetCachePersistence is set', async () => {
      GlobalConfig.set({
        presetCachePersistence: true,
        cacheTtlOverride: {
          preset: 60,
        },
      });

      config.extends = ['github>username/preset-repo'];
      config.packageRules = [
        {
          matchManagers: ['github-actions'],
          groupName: 'github-actions dependencies',
        },
      ];
      gitHub.getPreset.mockResolvedValueOnce({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
        ],
      });

      expect(await presets.resolveConfigPresets(config)).toBeDefined();
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        packageRules: [
          {
            matchDatasources: ['docker'],
            matchPackageNames: ['ubi'],
            versioning: 'regex',
          },
          {
            matchManagers: ['github-actions'],
            groupName: 'github-actions dependencies',
          },
        ],
      });

      expect(packageCache.set.mock.calls[0][3]).toBe(60);
    });
  });

  describe('replaceArgs', () => {
    const argMappings = {
      arg0: 'a',
      arg1: 'b',
      arg2: 'c',
    };

    it('replaces args in strings', () => {
      const str = '{{arg2}} foo {{arg0}}{{arg1}}';
      const res = presets.replaceArgs(str, argMappings);
      expect(res).toBe('c foo ab');
    });

    it('replaces args twice in same string', () => {
      const str = '{{arg2}}{{arg0}} foo {{arg0}}{{arg1}}';
      const res = presets.replaceArgs(str, argMappings);
      expect(res).toBe('ca foo ab');
    });

    it('replaces objects', () => {
      const obj = {
        foo: 'ha {{arg0}}',
        bar: {
          baz: '{{arg1}} boo',
          aaa: {
            bbb: 'woo {{arg2}}',
          },
        },
      };
      const res = presets.replaceArgs(obj, argMappings);
      expect(res).toEqual({
        bar: { aaa: { bbb: 'woo c' }, baz: 'b boo' },
        foo: 'ha a',
      });
    });

    it('replaces arrays', () => {
      const obj = {
        foo: ['{{arg0}}', { bar: '{{arg1}}', baz: 5 }],
      };
      const res = presets.replaceArgs(obj, argMappings);
      expect(res).toEqual({
        foo: ['a', { bar: 'b', baz: 5 }],
      });
    });
  });

  describe('parsePreset', () => {
    // default namespace
    it('returns default package name', () => {
      expect(presets.parsePreset(':base')).toEqual({
        repo: 'default',
        params: undefined,
        presetName: 'base',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });

    it('parses github', () => {
      expect(presets.parsePreset('github>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('handles special chars', () => {
      expect(presets.parsePreset('github>some/repo:foo+bar')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'foo+bar',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles', () => {
      expect(presets.parsePreset('github>some/repo:somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles with preset name', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile/somepreset'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github file with preset name with .json extension', () => {
      expect(presets.parsePreset('github>some/repo:somefile.json')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github file with preset name with .json5 extension', () => {
      expect(presets.parsePreset('github>some/repo:somefile.json5')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json5',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github subfiles with preset name with .json extension', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile.json/somepreset'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json/somepreset',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github subfiles with preset name with .json5 extension', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile.json5/somepreset'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json5/somepreset',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github subfiles with preset and sub-preset name', () => {
      expect(
        presets.parsePreset(
          'github>some/repo:somefile/somepreset/somesubpreset',
        ),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset/somesubpreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subdirectories', () => {
      expect(
        presets.parsePreset('github>some/repo//somepath/somesubpath/somefile'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: 'somepath/somesubpath',
        presetSource: 'github',
      });
    });

    it('parses github toplevel file using subdirectory syntax', () => {
      expect(presets.parsePreset('github>some/repo//somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses gitlab', () => {
      expect(presets.parsePreset('gitlab>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitlab',
      });
    });

    it('parses gitea', () => {
      expect(presets.parsePreset('gitea>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitea',
      });
    });

    it('parses local', () => {
      expect(presets.parsePreset('local>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local with spaces', () => {
      expect(presets.parsePreset('local>A2B CD/A2B_Renovate')).toEqual({
        repo: 'A2B CD/A2B_Renovate',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local with subdirectory', () => {
      expect(
        presets.parsePreset('local>some-group/some-repo//some-dir/some-file'),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });

    it('parses local with spaces and subdirectory', () => {
      expect(
        presets.parsePreset('local>A2B CD/A2B_Renovate//some-dir/some-file'),
      ).toEqual({
        repo: 'A2B CD/A2B_Renovate',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });

    it('parses local with sub preset and tag', () => {
      expect(
        presets.parsePreset(
          'local>some-group/some-repo:some-file/subpreset#1.2.3',
        ),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file/subpreset',
        presetPath: undefined,
        presetSource: 'local',
        tag: '1.2.3',
      });
    });

    it('parses local with subdirectory and tag', () => {
      expect(
        presets.parsePreset(
          'local>some-group/some-repo//some-dir/some-file#1.2.3',
        ),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
        tag: '1.2.3',
      });
    });

    it('parses local with subdirectory and branch/tag with a slash', () => {
      expect(
        presets.parsePreset(
          'local>PROJECT/repository//path/to/preset#feature/branch',
        ),
      ).toEqual({
        repo: 'PROJECT/repository',
        params: undefined,
        presetName: 'preset',
        presetPath: 'path/to',
        presetSource: 'local',
        tag: 'feature/branch',
      });
    });

    it('parses local with sub preset and branch/tag with a slash', () => {
      expect(
        presets.parsePreset(
          'local>PROJECT/repository:preset/subpreset#feature/branch',
        ),
      ).toEqual({
        repo: 'PROJECT/repository',
        params: undefined,
        presetName: 'preset/subpreset',
        presetPath: undefined,
        presetSource: 'local',
        tag: 'feature/branch',
      });
    });

    it('parses no prefix as local', () => {
      expect(presets.parsePreset('some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo with preset name', () => {
      expect(presets.parsePreset('local>~john_doe/repo//somefile')).toEqual({
        repo: '~john_doe/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo', () => {
      expect(presets.parsePreset('local>~john_doe/renovate-config')).toEqual({
        repo: '~john_doe/renovate-config',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('returns default package name with params', () => {
      expect(presets.parsePreset(':group(packages/eslint, eslint)')).toEqual({
        repo: 'default',
        params: ['packages/eslint', 'eslint'],
        presetName: 'group',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });

    // scoped namespace
    it('returns simple scope', () => {
      expect(presets.parsePreset('@somescope')).toEqual({
        repo: '@somescope/renovate-config',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns simple scope and params', () => {
      expect(presets.parsePreset('@somescope(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and default', () => {
      expect(presets.parsePreset('@somescope/somepackagename')).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and params and default', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename(param1, param2, param3)',
        ),
      ).toEqual({
        repo: '@somescope/somepackagename',
        params: ['param1', 'param2', 'param3'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName', () => {
      expect(presets.parsePreset('@somescope:somePresetName')).toEqual({
        repo: '@somescope/renovate-config',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName and params', () => {
      expect(presets.parsePreset('@somescope:somePresetName(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and presetName', () => {
      expect(
        presets.parsePreset('@somescope/somepackagename:somePresetName'),
      ).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and presetName and params', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename:somePresetName(param1, param2)',
        ),
      ).toEqual({
        repo: '@somescope/somepackagename',
        params: ['param1', 'param2'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    // non-scoped namespace
    it('returns non-scoped default', () => {
      expect(presets.parsePreset('somepackage')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name', () => {
      expect(presets.parsePreset('somepackage:webapp')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name full', () => {
      expect(presets.parsePreset('renovate-config-somepackage:webapp')).toEqual(
        {
          repo: 'renovate-config-somepackage',
          params: undefined,
          presetName: 'webapp',
          presetPath: undefined,
          presetSource: 'npm',
        },
      );
    });

    it('returns non-scoped package name with params', () => {
      expect(presets.parsePreset('somepackage:webapp(param1)')).toEqual({
        repo: 'renovate-config-somepackage',
        params: ['param1'],
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('parses HTTPS URLs', () => {
      expect(
        presets.parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTP URLs', () => {
      expect(
        presets.parsePreset(
          'http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain',
        ),
      ).toEqual({
        repo: 'http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain',
        params: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTPS URLs with parameters', () => {
      expect(
        presets.parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json(param1)',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: ['param1'],
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });
  });

  describe('getPreset', () => {
    it('handles removed presets with a migration', async () => {
      const res = await presets.getPreset(':base', {});
      expect(res).toEqual({
        extends: [
          ':dependencyDashboard',
          ':semanticPrefixFixDepsChoreOthers',
          ':ignoreModulesAndTests',
          'group:monorepos',
          'group:recommended',
          'replacements:all',
          'workarounds:all',
        ],
      });
    });

    it('handles removed presets with no migration', async () => {
      const res = await presets.getPreset('helpers:oddIsUnstable', {});
      expect(res).toEqual({});
    });

    it('handles renamed monorepos', async () => {
      const res = await presets.getPreset('monorepo:opentelemetry', {});
      expect(res).toMatchInlineSnapshot(`
        {
          "description": [
            "opentelemetry-js monorepo",
          ],
          "matchSourceUrls": [
            "https://github.com/open-telemetry/opentelemetry-js",
          ],
        }
      `);
    });

    it('handles renamed monorepo groups', async () => {
      const res = await presets.getPreset('group:opentelemetryMonorepo', {});
      expect(res).toMatchInlineSnapshot(`
        {
          "packageRules": [
            {
              "description": [
                "Group packages from opentelemetry-js monorepo together.",
              ],
              "extends": [
                "monorepo:opentelemetry-js",
              ],
              "groupName": "opentelemetry-js monorepo",
              "matchUpdateTypes": [
                "digest",
                "patch",
                "minor",
                "major",
              ],
            },
          ],
        }
      `);
    });

    it('gets linters', async () => {
      const res = await presets.getPreset('packages:linters', {});
      expect(res).toMatchSnapshot();
      expect(res.matchPackageNames).toHaveLength(3);
      expect(res.extends).toHaveLength(5);
    });

    it('gets parameterised configs', async () => {
      const res = await presets.getPreset(
        ':group(packages:eslint, eslint)',
        {},
      );
      expect(res).toEqual({
        description: ['Group `eslint` packages into same branch/PR.'],
        packageRules: [
          {
            extends: ['packages:eslint'],
            groupName: 'eslint',
          },
        ],
      });
    });

    it('handles missing params', async () => {
      const res = await presets.getPreset(':group()', {});
      expect(res).toEqual({
        description: ['Group `{{arg1}}` packages into same branch/PR.'],
        packageRules: [
          {
            extends: [],
            groupName: '{{arg1}}',
          },
        ],
      });
    });

    it('ignores irrelevant params', async () => {
      const res = await presets.getPreset(':pinVersions(foo, bar)', {});
      expect(res).toEqual({
        description: [
          'Use version pinning (maintain a single version only and not SemVer ranges).',
        ],
        rangeStrategy: 'pin',
      });
    });

    it('handles 404 packages', async () => {
      let e: Error | undefined;
      try {
        await presets.getPreset('notfound:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toMatchSnapshot();
      expect(e!.validationError).toMatchSnapshot();
      expect(e!.validationMessage).toMatchSnapshot();
    });

    it('handles no config', async () => {
      let e: Error | undefined;
      try {
        await presets.getPreset('noconfig:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBeUndefined();
      expect(e!.validationMessage).toBeUndefined();
    });

    it('handles throw errors', async () => {
      let e: Error | undefined;
      try {
        await presets.getPreset('throw:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBeUndefined();
      expect(e!.validationMessage).toBeUndefined();
    });

    it('handles preset not found', async () => {
      let e: Error | undefined;
      try {
        await presets.getPreset('wrongpreset:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBeUndefined();
      expect(e!.validationMessage).toBeUndefined();
    });
  });
});
