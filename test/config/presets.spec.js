const npm = require('../../lib/datasource/npm');
const presets = require('../../lib/config/presets');
const presetDefaults = require('../_fixtures/npm/renovate-config-default');
const presetPackages = require('../_fixtures/npm/renovate-config-packages');
const presetGroup = require('../_fixtures/npm/renovate-config-group');
const presetMonorepo = require('../_fixtures/npm/renovate-config-monorepo');
const presetIkatyang = require('../_fixtures/npm/renovate-config-ikatyang');

npm.getDependency = jest.fn(dep => {
  if (dep === 'renovate-config-default') {
    return {
      'renovate-config':
        presetDefaults.versions[presetDefaults['dist-tags'].latest][
          'renovate-config'
        ],
    };
  }
  if (dep === 'renovate-config-packages') {
    return {
      'renovate-config':
        presetPackages.versions[presetPackages['dist-tags'].latest][
          'renovate-config'
        ],
    };
  }
  if (dep === 'renovate-config-group') {
    return {
      'renovate-config':
        presetGroup.versions[presetGroup['dist-tags'].latest][
          'renovate-config'
        ],
    };
  }
  if (dep === 'renovate-config-ikatyang') {
    return {
      'renovate-config':
        presetIkatyang.versions[presetIkatyang['dist-tags'].latest][
          'renovate-config'
        ],
    };
  }
  if (dep === 'renovate-config-monorepo') {
    return {
      'renovate-config':
        presetMonorepo.versions[presetMonorepo['dist-tags'].latest][
          'renovate-config'
        ],
    };
  }
  if (dep === 'renovate-config-noconfig') {
    return {};
  }
  if (dep === 'renovate-config-throw') {
    throw new Error('whoops');
  }
  if (dep === 'renovate-config-wrongpreset') {
    return {
      'renovate-config': {},
    };
  }
  return null;
});

describe('config/presets', () => {
  describe('resolvePreset', () => {
    let config;
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
      config.extends = ['notfoundaaaaaaaa'];
      let e;
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
      config.extends = [':invalid-preset'];
      let e;
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
      config.extends = [':pinVersions'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.pinVersions).toBe(true);
    });
    it('throws if valid and invalid', async () => {
      config.foo = 1;
      config.extends = [':invalid-preset', ':pinVersions'];
      let e;
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
    it('resolves app preset', async () => {
      config.extends = [':app'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves group monorepos', async () => {
      config.extends = ['group:monorepos'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
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
      expect(res.packageNames).toHaveLength(1);
      expect(res.packagePatterns).toHaveLength(2);
    });
    it('resolves nested groups', async () => {
      config.extends = [':automergeLinters'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      const rule = res.packageRules[0];
      expect(rule.automerge).toEqual(true);
      expect(rule.packageNames).toHaveLength(1);
      expect(rule.packagePatterns).toHaveLength(2);
    });
    it('migrates automerge in presets', async () => {
      config.extends = ['ikatyang:library'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.automerge).not.toBeDefined();
      expect(res.minor.automerge).toBe(true);
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
      const res = await presets.getPreset('packages:linters');
      expect(res).toMatchSnapshot();
      expect(res.packageNames).toHaveLength(1);
      expect(res.extends).toHaveLength(2);
    });
    it('gets parameterised configs', async () => {
      const res = await presets.getPreset(':group(packages:eslint, eslint)');
      expect(res).toMatchSnapshot();
    });
    it('handles missing params', async () => {
      const res = await presets.getPreset(':group()');
      expect(res).toMatchSnapshot();
    });
    it('ignores irrelevant params', async () => {
      const res = await presets.getPreset(':pinVersions(foo, bar)');
      expect(res).toMatchSnapshot();
    });
    it('handles 404 packages', async () => {
      let e;
      try {
        await presets.getPreset('notfound:foo');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles no config', async () => {
      let e;
      try {
        await presets.getPreset('noconfig:foo');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles throw errors', async () => {
      let e;
      try {
        await presets.getPreset('throw:foo');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('handles preset not found', async () => {
      let e;
      try {
        await presets.getPreset('wrongpreset:foo');
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
