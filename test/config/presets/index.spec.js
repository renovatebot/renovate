const presets = require('../../../lib/config/presets');
const logger = require('../../_fixtures/logger');

describe('config/presets', () => {
  describe('resolvePreset', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        logger,
      };
    });
    it('returns same if no presets', () => {
      config.foo = 1;
      config.extends = [];
      const res = presets.resolveConfigPresets(config);
      expect(config).toMatchObject(res);
      expect(res).toMatchSnapshot();
    });
    it('returns same if invalid preset', () => {
      config.foo = 1;
      config.extends = ['invalid-preset'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('works with valid and invalid', () => {
      config.foo = 1;
      config.extends = ['invalid-preset', 'pinVersions'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves app preset', () => {
      config.extends = ['app'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('combines two package alls', () => {
      config.extends = ['packages:eslint', 'packages:stylelint'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves packageRule', () => {
      config.packageRules = [
        {
          extends: ['packages:eslint'],
          groupName: 'eslint',
        },
      ];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves nested groups', () => {
      config.extends = ['automergeLinters'];
      const res = presets.resolveConfigPresets(config);
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
    it('returns simple scope', () => {
      expect(presets.parsePreset('@somescope')).toMatchSnapshot();
    });
    it('returns simple scope and params', () => {
      expect(presets.parsePreset('@somescope(param1)')).toMatchSnapshot();
    });
    it('returns scope with packageName', () => {
      expect(
        presets.parsePreset('@somescope/somepackagename')
      ).toMatchSnapshot();
    });
    it('returns scope with packageName and params', () => {
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
  });
  describe('getPreset', () => {
    it('gets parameterised configs', () => {
      const res = presets.getPreset('group(packages:eslint, eslint)', logger);
      expect(res).toMatchSnapshot();
    });
    it('handles missing params', () => {
      const res = presets.getPreset('group()', logger);
      expect(res).toMatchSnapshot();
    });
    it('ignores irrelevant params', () => {
      const res = presets.getPreset('pinVersions(foo, bar)', logger);
      expect(res).toMatchSnapshot();
    });
  });
});
