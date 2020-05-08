import { RenovateConfig } from '..';
import { mocked } from '../../../test/util';
import presetIkatyang from './__fixtures__/renovate-config-ikatyang.json';
import * as _npm from './npm';
import * as presets from '.';

jest.mock('./npm');
jest.mock('./github');

const npm = mocked(_npm);

npm.getPreset = jest.fn(({ packageName, presetName }) => {
  if (packageName === 'renovate-config-ikatyang') {
    return presetIkatyang.versions[presetIkatyang['dist-tags'].latest][
      'renovate-config'
    ][presetName];
  }
  if (packageName === 'renovate-config-notfound') {
    throw new Error('dep not found');
  }
  if (packageName === 'renovate-config-noconfig') {
    throw new Error('preset renovate-config not found');
  }
  if (packageName === 'renovate-config-throw') {
    throw new Error('whoops');
  }
  if (packageName === 'renovate-config-wrongpreset') {
    throw new Error('preset not found');
  }
  return null;
});

describe('config/presets', () => {
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
      expect(res).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });

    it('works with valid', async () => {
      config.foo = 1;
      config.ignoreDeps = [];
      config.extends = [':pinVersions'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('combines two package alls', async () => {
      config.extends = ['packages:eslint', 'packages:stylelint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves packageRule', async () => {
      config.packageRules = [
        {
          extends: ['packages:eslint'],
          groupName: 'eslint',
        },
      ];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves eslint', async () => {
      config.extends = ['packages:eslint'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.packagePatterns).toHaveLength(1);
    });
    it('resolves linters', async () => {
      config.extends = ['packages:linters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.packageNames).toHaveLength(3);
      expect(res.packagePatterns).toHaveLength(3);
    });
    it('resolves nested groups', async () => {
      config.extends = [':automergeLinters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      const rule = res.packageRules[0];
      expect(rule.automerge).toBe(true);
      expect(rule.packageNames).toHaveLength(3);
      expect(rule.packagePatterns).toHaveLength(3);
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
    });
    it('replaces arrays', () => {
      const obj = {
        foo: [
          '{{arg0}}',
          {
            bar: '{{arg1}}',
            baz: 5,
          },
        ],
      };
      const res = presets.replaceArgs(obj, argMappings);
      expect(res).toMatchSnapshot();
    });
  });
  describe('parsePreset', () => {
    // default namespace
    it('returns default package name', () => {
      expect(presets.parsePreset(':base')).toMatchSnapshot();
    });
    it('parses github', () => {
      expect(presets.parsePreset('github>some/repo')).toMatchSnapshot();
    });
    it('parses github subfiles', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile')
      ).toMatchSnapshot();
    });
    it('parses github subfiles with preset name', () => {
      expect(
        presets.parsePreset('github>some/repo:somefile/somepreset')
      ).toMatchSnapshot();
    });
    it('parses github subfiles with preset and sub-preset name', () => {
      expect(
        presets.parsePreset(
          'github>some/repo:somefile/somepreset/somesubpreset'
        )
      ).toMatchSnapshot();
    });
    it('parses gitlab', () => {
      expect(presets.parsePreset('gitlab>some/repo')).toMatchSnapshot();
    });
    it('parses local', () => {
      expect(presets.parsePreset('local>some/repo')).toMatchSnapshot();
    });
    it('parses no prefix as local', () => {
      expect(presets.parsePreset('some/repo')).toMatchSnapshot();
    });
    it('returns default package name with params', () => {
      expect(
        presets.parsePreset(':group(packages/eslint, eslint)')
      ).toMatchSnapshot();
    });
    // scoped namespace
    it('returns simple scope', () => {
      expect(presets.parsePreset('@somescope')).toMatchSnapshot();
    });
    it('returns simple scope and params', () => {
      expect(presets.parsePreset('@somescope(param1)')).toMatchSnapshot();
    });
    it('returns scope with packageName and default', () => {
      expect(
        presets.parsePreset('@somescope/somepackagename')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and params and default', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename(param1, param2, param3)'
        )
      ).toMatchSnapshot();
    });
    it('returns scope with presetName', () => {
      expect(
        presets.parsePreset('@somescope:somePresetName')
      ).toMatchSnapshot();
    });
    it('returns scope with presetName and params', () => {
      expect(
        presets.parsePreset('@somescope:somePresetName(param1)')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and presetName', () => {
      expect(
        presets.parsePreset('@somescope/somepackagename:somePresetName')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and presetName and params', () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename:somePresetName(param1, param2)'
        )
      ).toMatchSnapshot();
    });
    // non-scoped namespace
    it('returns non-scoped default', () => {
      expect(presets.parsePreset('somepackage')).toMatchSnapshot();
    });
    it('returns non-scoped package name', () => {
      expect(presets.parsePreset('somepackage:webapp')).toMatchSnapshot();
    });
    it('returns non-scoped package name full', () => {
      expect(
        presets.parsePreset('renovate-config-somepackage:webapp')
      ).toMatchSnapshot();
    });
    it('returns non-scoped package name with params', () => {
      expect(
        presets.parsePreset('somepackage:webapp(param1)')
      ).toMatchSnapshot();
    });
  });
  describe('getPreset', () => {
    it('gets linters', async () => {
      const res = await presets.getPreset('packages:linters', {});
      expect(res).toMatchSnapshot();
      expect(res.packageNames).toHaveLength(1);
      expect(res.extends).toHaveLength(3);
    });
    it('gets parameterised configs', async () => {
      const res = await presets.getPreset(
        ':group(packages:eslint, eslint)',
        {}
      );
      expect(res).toMatchSnapshot();
    });
    it('handles missing params', async () => {
      const res = await presets.getPreset(':group()', {});
      expect(res).toMatchSnapshot();
    });
    it('ignores irrelevant params', async () => {
      const res = await presets.getPreset(':pinVersions(foo, bar)', {});
      expect(res).toMatchSnapshot();
    });
    it('handles 404 packages', async () => {
      let e: Error;
      try {
        await presets.getPreset('notfound:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
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
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles throw errors', async () => {
      let e: Error;
      try {
        await presets.getPreset('throw:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles preset not found', async () => {
      let e: Error;
      try {
        await presets.getPreset('wrongpreset:foo', {});
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
  });
});
