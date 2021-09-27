import { loadJsonFixture, mocked } from '../../../test/util';
import type { RenovateConfig } from '../types';
import * as _local from './local';
import * as _npm from './npm';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_NOT_FOUND,
  PRESET_RENOVATE_CONFIG_NOT_FOUND,
} from './util';
import * as presets from '.';

jest.mock('./npm');
jest.mock('./github');
jest.mock('./local');

const npm = mocked(_npm);
const local = mocked(_local);

const presetIkatyang = loadJsonFixture('renovate-config-ikatyang.json');

npm.getPreset = jest.fn(({ packageName, presetName }) => {
  if (packageName === 'renovate-config-ikatyang') {
    return presetIkatyang.versions[presetIkatyang['dist-tags'].latest][
      'renovate-config'
    ][presetName];
  }
  if (packageName === 'renovate-config-notfound') {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  if (packageName === 'renovate-config-noconfig') {
    throw new Error(PRESET_RENOVATE_CONFIG_NOT_FOUND);
  }
  if (packageName === 'renovate-config-throw') {
    throw new Error('whoops');
  }
  if (packageName === 'renovate-config-wrongpreset') {
    throw new Error(PRESET_NOT_FOUND);
  }
  return null;
});

describe('config/presets/index', () => {
  describe('resolvePreset', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = {};
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
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        "Cannot find preset's package (notfound)"
      );
      expect(e.validationMessage).toBeUndefined();
    });
    it('throws if invalid preset', async () => {
      config.foo = 1;
      config.extends = ['wrongpreset:invalid-preset'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        'Preset name not found within published preset config (wrongpreset:invalid-preset)'
      );
      expect(e.validationMessage).toBeUndefined();
    });

    it('throws if path + invalid syntax', async () => {
      config.foo = 1;
      config.extends = ['github>user/repo//'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        'Preset is invalid (github>user/repo//)'
      );
      expect(e.validationMessage).toBeUndefined();
    });

    it('throws if path + sub-preset', async () => {
      config.foo = 1;
      config.extends = ['github>user/repo//path:subpreset'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        'Sub-presets cannot be combined with a custom path (github>user/repo//path:subpreset)'
      );
      expect(e.validationMessage).toBeUndefined();
    });

    it('throws noconfig', async () => {
      config.foo = 1;
      config.extends = ['noconfig:base'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        'Preset package is missing a renovate-config entry (noconfig:base)'
      );
      expect(e.validationMessage).toBeUndefined();
    });

    it('throws throw', async () => {
      config.foo = 1;
      config.extends = ['throw:base'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toBeUndefined();
      expect(e.validationMessage).toBeUndefined();
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
      expect(res.rangeStrategy).toEqual('pin');
    });
    it('throws if valid and invalid', async () => {
      config.foo = 1;
      config.extends = ['wrongpreset:invalid-preset', ':pinVersions'];
      let e: Error;
      try {
        await presets.resolveConfigPresets(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toEqual(
        'Preset name not found within published preset config (wrongpreset:invalid-preset)'
      );
      expect(e.validationMessage).toBeUndefined();
    });
    it('combines two package alls', async () => {
      config.extends = ['packages:eslint', 'packages:stylelint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toEqual({
        matchPackageNames: ['@types/eslint', 'babel-eslint'],
        matchPackagePrefixes: ['@typescript-eslint/', 'eslint', 'stylelint'],
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
            matchPackageNames: ['@types/eslint', 'babel-eslint'],
            matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
          },
        ],
      });
    });
    it('resolves eslint', async () => {
      config.extends = ['packages:eslint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackagePrefixes).toHaveLength(2);
    });
    it('resolves linters', async () => {
      config.extends = ['packages:linters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.matchPackageNames).toHaveLength(4);
      expect(res.matchPackagePatterns).toHaveLength(1);
      expect(res.matchPackagePrefixes).toHaveLength(4);
    });
    it('resolves nested groups', async () => {
      config.extends = [':automergeLinters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      const rule = res.packageRules[0];
      expect(rule.automerge).toBe(true);
      expect(rule.matchPackageNames).toHaveLength(4);
      expect(rule.matchPackagePatterns).toHaveLength(1);
      expect(rule.matchPackagePrefixes).toHaveLength(4);
    });
    it('migrates automerge in presets', async () => {
      config.extends = ['ikatyang:library'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.automerge).not.toBeDefined();
      expect(res.minor.automerge).toBe(true);
    });

    it('ignores presets', async () => {
      config.extends = ['config:base'];
      const res = await presets.resolveConfigPresets(config, {}, [
        'config:base',
      ]);
      expect(config).toMatchObject(res);
      expect(res).toEqual({});
    });

    it('resolves self-hosted presets without baseConfig', async () => {
      config.extends = ['local>username/preset-repo'];
      local.getPreset = jest.fn(({ packageName, presetName, baseConfig }) =>
        Promise.resolve({ labels: ['self-hosted resolved'] })
      );

      const res = await presets.resolveConfigPresets(config);

      expect(res.labels).toEqual(['self-hosted resolved']);
      expect(local.getPreset.mock.calls).toHaveLength(1);
      expect(local.getPreset.mock.calls[0][0].baseConfig).not.toBeUndefined();
      expect(res).toMatchSnapshot();
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
      expect(res).toEqual('c foo ab');
    });
    it('replaces args twice in same string', () => {
      const str = '{{arg2}}{{arg0}} foo {{arg0}}{{arg1}}';
      const res = presets.replaceArgs(str, argMappings);
      expect(res).toEqual('ca foo ab');
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
        packageName: 'default',
        params: undefined,
        presetName: 'base',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });
    it('parses github', () => {
      expect(presets.parsePreset('github>some/repo')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'github',
      });
    });
    it('parses github subfiles', () => {
      expect(presets.parsePreset('github>some/repo:somefile')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });
    it('parses github subfiles with preset name', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile/somepreset')
      ).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });
    it('parses github subfiles with preset and sub-preset name', () => {
      expect(
        presets.parsePreset(
          'github>some/repo:somefile/somepreset/somesubpreset'
        )
      ).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset/somesubpreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });
    it('parses github subdirectories', () => {
      expect(
        presets.parsePreset('github>some/repo//somepath/somesubpath/somefile')
      ).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: 'somepath/somesubpath',
        presetSource: 'github',
      });
    });
    it('parses github toplevel file using subdirectory syntax', () => {
      expect(presets.parsePreset('github>some/repo//somefile')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });
    it('parses gitlab', () => {
      expect(presets.parsePreset('gitlab>some/repo')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitlab',
      });
    });
    it('parses gitea', () => {
      expect(presets.parsePreset('gitea>some/repo')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitea',
      });
    });
    it('parses local', () => {
      expect(presets.parsePreset('local>some/repo')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });
    it('parses local with subdirectory', () => {
      expect(
        presets.parsePreset('local>some-group/some-repo//some-dir/some-file')
      ).toEqual({
        packageName: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });
    it('parses no prefix as local', () => {
      expect(presets.parsePreset('some/repo')).toEqual({
        packageName: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });
    it('returns default package name with params', () => {
      expect(presets.parsePreset(':group(packages/eslint, eslint)')).toEqual({
        packageName: 'default',
        params: ['packages/eslint', 'eslint'],
        presetName: 'group',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });
    // scoped namespace
    it('returns simple scope', () => {
      expect(presets.parsePreset('@somescope')).toEqual({
        packageName: '@somescope/renovate-config',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns simple scope and params', () => {
      expect(presets.parsePreset('@somescope(param1)')).toEqual({
        packageName: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with packageName and default', () => {
      expect(presets.parsePreset('@somescope/somepackagename')).toEqual({
        packageName: '@somescope/somepackagename',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with packageName and params and default', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename(param1, param2, param3)'
        )
      ).toEqual({
        packageName: '@somescope/somepackagename',
        params: ['param1', 'param2', 'param3'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with presetName', () => {
      expect(presets.parsePreset('@somescope:somePresetName')).toEqual({
        packageName: '@somescope/renovate-config',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with presetName and params', () => {
      expect(presets.parsePreset('@somescope:somePresetName(param1)')).toEqual({
        packageName: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with packageName and presetName', () => {
      expect(
        presets.parsePreset('@somescope/somepackagename:somePresetName')
      ).toEqual({
        packageName: '@somescope/somepackagename',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns scope with packageName and presetName and params', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename:somePresetName(param1, param2)'
        )
      ).toEqual({
        packageName: '@somescope/somepackagename',
        params: ['param1', 'param2'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    // non-scoped namespace
    it('returns non-scoped default', () => {
      expect(presets.parsePreset('somepackage')).toEqual({
        packageName: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns non-scoped package name', () => {
      expect(presets.parsePreset('somepackage:webapp')).toEqual({
        packageName: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });
    it('returns non-scoped package name full', () => {
      expect(presets.parsePreset('renovate-config-somepackage:webapp')).toEqual(
        {
          packageName: 'renovate-config-somepackage',
          params: undefined,
          presetName: 'webapp',
          presetPath: undefined,
          presetSource: 'npm',
        }
      );
    });
    it('returns non-scoped package name with params', () => {
      expect(presets.parsePreset('somepackage:webapp(param1)')).toEqual({
        packageName: 'renovate-config-somepackage',
        params: ['param1'],
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
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
          ':autodetectPinVersions',
          ':prHourlyLimit2',
          ':prConcurrentLimit20',
          'group:monorepos',
          'group:recommended',
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
Object {
  "description": Array [
    "opentelemetry-js monorepo",
  ],
  "matchSourceUrlPrefixes": Array [
    "https://github.com/open-telemetry/opentelemetry-js",
  ],
}
`);
    });
    it('handles renamed monorepo groups', async () => {
      const res = await presets.getPreset('group:opentelemetryMonorepo', {});
      expect(res).toMatchInlineSnapshot(`
Object {
  "packageRules": Array [
    Object {
      "description": Array [
        "Group packages from opentelemetry-js monorepo together",
      ],
      "extends": Array [
        "monorepo:opentelemetry-js",
      ],
      "groupName": "opentelemetry-js monorepo",
      "matchUpdateTypes": Array [
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
      expect(res.matchPackageNames).toHaveLength(1);
      expect(res.extends).toHaveLength(4);
    });
    it('gets parameterised configs', async () => {
      const res = await presets.getPreset(
        ':group(packages:eslint, eslint)',
        {}
      );
      expect(res).toEqual({
        description: ['Group eslint packages into same branch/PR'],
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
        description: ['Group {{arg1}} packages into same branch/PR'],
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
          'Use version pinning (maintain a single version only and not semver ranges)',
        ],
        rangeStrategy: 'pin',
      });
    });
    it('handles 404 packages', async () => {
      let e: Error;
      try {
        await presets.getPreset('notfound:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles no config', async () => {
      let e: Error;
      try {
        await presets.getPreset('noconfig:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toBeUndefined();
      expect(e.validationMessage).toBeUndefined();
    });
    it('handles throw errors', async () => {
      let e: Error;
      try {
        await presets.getPreset('throw:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toBeUndefined();
      expect(e.validationMessage).toBeUndefined();
    });
    it('handles preset not found', async () => {
      let e: Error;
      try {
        await presets.getPreset('wrongpreset:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.validationSource).toBeUndefined();
      expect(e.validationError).toBeUndefined();
      expect(e.validationMessage).toBeUndefined();
    });
  });
});
