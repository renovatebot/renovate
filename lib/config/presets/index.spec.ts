import { mockDeep } from 'vitest-mock-extended';
import { PLATFORM_RATE_LIMIT_EXCEEDED } from '../../constants/error-messages';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../../util/cache/memory';
import * as _packageCache from '../../util/cache/package';
import { setCustomEnv } from '../../util/env';
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
import { Fixtures } from '~test/fixtures';
import { logger } from '~test/util';

vi.mock('./npm');
vi.mock('./github');
vi.mock('./local');
vi.mock('../../util/cache/package', () => mockDeep());

const npm = vi.mocked(_npm);
const local = vi.mocked(_local);
const gitHub = vi.mocked(_github);
const packageCache = vi.mocked(_packageCache);

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

    it('skips duplicate resolves', async () => {
      config.extends = ['local>some/repo:a', 'local>some/repo:b'];
      local.getPreset.mockResolvedValueOnce({ extends: ['local>some/repo:c'] });
      local.getPreset.mockResolvedValueOnce({ extends: ['local>some/repo:c'] });
      local.getPreset.mockResolvedValueOnce({ foo: 1 });
      expect(await presets.resolveConfigPresets(config)).toEqual({
        foo: 1,
      });
      expect(local.getPreset).toHaveBeenCalledTimes(3);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Already seen preset local>some/repo:c in [local>some/repo:a, local>some/repo:c]',
      );
    });

    it('throws if invalid preset file', async () => {
      config.foo = 1;
      config.extends = ['local>some/repo'];

      local.getPreset.mockResolvedValueOnce({ extends: ['notfound'] });
      let e: Error | undefined;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e!.validationSource).toBeUndefined();
      expect(e!.validationError).toBe(
        "Cannot find preset's package (notfound)." +
          ' Note: this is a *nested* preset so please contact the preset author if you are unable to fix it yourself.',
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
              '@eslint/**',
              '@eslint-community/**',
              '@stylistic/eslint-plugin**',
              '@types/eslint__**',
              '@typescript-eslint/**',
              'typescript-eslint',
              'eslint**',
            ],
          },
        ],
      });
    });

    it('resolves eslint', async () => {
      config.extends = ['packages:eslint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackageNames).toHaveLength(10);
    });

    it('resolves linters', async () => {
      config.extends = ['packages:linters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackageNames).toHaveLength(20);
    });

    it('resolves nested groups', async () => {
      config.extends = [':automergeLinters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      const rule = res.packageRules![0];
      expect(rule.automerge).toBeTrue();
      expect(rule.matchPackageNames).toHaveLength(20);
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

    it('resolves self-hosted preset with templating', async () => {
      setCustomEnv({ GIT_REF: 'abc123' });
      config.extends = ['local>username/preset-repo#{{ env.GIT_REF }}'];
      local.getPreset.mockImplementationOnce(({ tag }) =>
        tag === 'abc123'
          ? Promise.resolve({ labels: ['self-hosted with template resolved'] })
          : Promise.reject(new Error('Failed to resolve self-hosted preset')),
      );

      const res = await presets.resolveConfigPresets(config);

      expect(res.labels).toEqual(['self-hosted with template resolved']);
      expect(local.getPreset).toHaveBeenCalledOnce();
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

    it('throws', async () => {
      config.extends = ['local>username/preset-repo'];

      local.getPreset.mockRejectedValueOnce(
        new ExternalHostError(new Error('whoops')),
      );
      await expect(presets.resolveConfigPresets(config)).rejects.toThrow(
        ExternalHostError,
      );

      local.getPreset.mockRejectedValueOnce(
        new Error(PLATFORM_RATE_LIMIT_EXCEEDED),
      );
      await expect(presets.resolveConfigPresets(config)).rejects.toThrow(
        PLATFORM_RATE_LIMIT_EXCEEDED,
      );
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
          'mergeConfidence:age-confidence-badges',
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

    it('handles renamed regexManagers presets', async () => {
      const res = await presets.getPreset(
        'regexManagers:dockerfileVersions',
        {},
      );
      expect(res.customManagers).toHaveLength(1);
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

    it('substitutes {{args}}', async () => {
      local.getPreset.mockResolvedValueOnce({
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['{{args}}'],
            matchStrings: ['# renovate: ...'],
          },
        ],
      });
      const res = await presets.getPreset(
        'local>customManager(**/{*.py, *.yaml})',
        {},
      );
      expect(res).toEqual({
        customManagers: [
          {
            customType: 'regex',
            // The space after comma is obviously incorrect here.
            // But the test must ensure that spaces aren't removed.
            managerFilePatterns: ['**/{*.py, *.yaml}'],
            matchStrings: ['# renovate: ...'],
          },
        ],
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
