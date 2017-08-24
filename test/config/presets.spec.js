const npm = require('../../lib/api/npm');
const presets = require('../../lib/config/presets');
const logger = require('../_fixtures/logger');
const presetDefaults = require('../_fixtures/npm/renovate-config-default');
const presetPackages = require('../_fixtures/npm/renovate-config-packages');
const presetGroup = require('../_fixtures/npm/renovate-config-group');
const presetMonorepo = require('../_fixtures/npm/renovate-config-monorepo');

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
      config = {
        logger,
      };
    });
    it('returns same if no presets', async () => {
      config.foo = 1;
      config.extends = [];
      const res = await presets.resolveConfigPresets(config);
      expect(config).toMatchObject(res);
      expect(res).toMatchSnapshot();
    });
    it('returns same if invalid preset', async () => {
      config.foo = 1;
      config.extends = [':invalid-preset'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('works with valid', async () => {
      config.foo = 1;
      config.extends = [':pinVersions'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.pinVersions).toBe(true);
    });
    it('works with valid and invalid', async () => {
      config.foo = 1;
      config.extends = [':invalid-preset', ':pinVersions'];
      const res = await presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
      expect(res.pinVersions).toBe(true);
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
  });
  describe('replaceArgs', () => {
    const argMappings = {
      arg0: 'a',
      arg1: 'b',
      arg2: 'c',
    };
    it('replaces args in strings', async () => {
      const str = '{{arg2}} foo {{arg0}}{{arg1}}';
      const res = presets.replaceArgs(str, argMappings);
      expect(res).toMatchSnapshot();
    });
    it('replaces args twice in same string', async () => {
      const str = '{{arg2}}{{arg0}} foo {{arg0}}{{arg1}}';
      const res = presets.replaceArgs(str, argMappings);
      expect(res).toEqual('ca foo ab');
    });
    it('replaces objects', async () => {
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
    it('replaces arrays', async () => {
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
    it('returns default package name', async () => {
      expect(presets.parsePreset(':base')).toMatchSnapshot();
    });
    it('returns default package name with params', async () => {
      expect(
        presets.parsePreset(':group(packages/eslint, eslint)')
      ).toMatchSnapshot();
    });
    // scoped namespace
    it('returns simple scope', async () => {
      expect(presets.parsePreset('@somescope')).toMatchSnapshot();
    });
    it('returns simple scope and params', async () => {
      expect(presets.parsePreset('@somescope(param1)')).toMatchSnapshot();
    });
    it('returns scope with packageName and default', async () => {
      expect(
        presets.parsePreset('@somescope/somepackagename')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and params and default', async () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename(param1, param2, param3)'
        )
      ).toMatchSnapshot();
    });
    it('returns scope with presetName', async () => {
      expect(
        presets.parsePreset('@somescope:somePresetName')
      ).toMatchSnapshot();
    });
    it('returns scope with presetName and params', async () => {
      expect(
        presets.parsePreset('@somescope:somePresetName(param1)')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and presetName', async () => {
      expect(
        presets.parsePreset('@somescope/somepackagename:somePresetName')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and presetName and params', async () => {
      expect(
        presets.parsePreset(
          '@somescope/somepackagename:somePresetName(param1, param2)'
        )
      ).toMatchSnapshot();
    });
    // non-scoped namespace
    it('returns non-scoped default', async () => {
      expect(presets.parsePreset('somepackage')).toMatchSnapshot();
    });
    it('returns non-scoped package name', async () => {
      expect(presets.parsePreset('somepackage:webapp')).toMatchSnapshot();
    });
    it('returns non-scoped package name full', async () => {
      expect(
        presets.parsePreset('renovate-config-somepackage:webapp')
      ).toMatchSnapshot();
    });
    it('returns non-scoped package name with params', async () => {
      expect(
        presets.parsePreset('somepackage:webapp(param1)')
      ).toMatchSnapshot();
    });
  });
  describe('getPreset', () => {
    it('gets linters', async () => {
      const res = await presets.getPreset('packages:linters', logger);
      expect(res).toMatchSnapshot();
      expect(res.packageNames).toHaveLength(1);
      expect(res.extends).toHaveLength(2);
    });
    it('gets parameterised configs', async () => {
      const res = await presets.getPreset(
        ':group(packages:eslint, eslint)',
        logger
      );
      expect(res).toMatchSnapshot();
    });
    it('handles missing params', async () => {
      const res = await presets.getPreset(':group()', logger);
      expect(res).toMatchSnapshot();
    });
    it('ignores irrelevant params', async () => {
      const res = await presets.getPreset(':pinVersions(foo, bar)', logger);
      expect(res).toMatchSnapshot();
    });
    it('handles 404 packages', async () => {
      const res = await presets.getPreset('notfound:foo', logger);
      expect(res).toMatchSnapshot();
    });
    it('handles no config', async () => {
      const res = await presets.getPreset('noconfig:foo', logger);
      expect(res).toMatchSnapshot();
    });
    it('handles throw errors', async () => {
      const res = await presets.getPreset('throw:foo', logger);
      expect(res).toMatchSnapshot();
    });
    it('handles preset not found', async () => {
      const res = await presets.getPreset('wrongpreset:foo', logger);
      expect(res).toMatchSnapshot();
    });
  });
});
