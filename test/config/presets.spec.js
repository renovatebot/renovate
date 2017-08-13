const presets = require('../../lib/config/presets');
const logger = require('../_fixtures/logger');
const presetGroups = require('../../lib/config/presetGroups');
const presetDefaults = require('../../lib/config/presetDefaults');

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
    it('works with vaid and invalid', () => {
      config.foo = 1;
      config.extends = ['invalid-preset', 'pinVersions'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves group with parent description', () => {
      config.extends = ['groupJest'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves app preset', () => {
      config.extends = ['app'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('combines two package alls', () => {
      config.extends = ['allEslint', 'allStylelint'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves packageRule', () => {
      config.packageRules = [
        {
          extends: ['allEslint'],
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
});
describe('presetGroups', () => {
  for (const key of Object.keys(presetGroups)) {
    it(`has a description for ${key}`, () => {
      expect(presetGroups[key].description).toBeDefined();
    });
  }
});
describe('presetDefaults', () => {
  it('has no conflict with presetGroups', () => {
    const overlap = [];
    const groups = Object.keys(presetGroups);
    for (const presetDefault of Object.keys(presetDefaults)) {
      if (groups.indexOf(presetDefault) !== -1) {
        overlap.push(presetDefault);
      }
    }
    expect(overlap).toEqual([]);
  });
  for (const key of Object.keys(presetDefaults)) {
    it(`has a description for ${key}`, () => {
      expect(presetDefaults[key].description).toBeDefined();
    });
  }
});
