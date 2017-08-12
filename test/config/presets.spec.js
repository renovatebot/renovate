const presets = require('../../lib/config/presets');
const logger = require('../_fixtures/logger');

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
      const res = presets.resolvePresets(config);
      expect(config).toMatchObject(res);
      expect(res).toMatchSnapshot();
    });
    it('returns same if invalid preset', () => {
      config.foo = 1;
      config.extends = ['invalid-preset'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('works with vaid and invalid', () => {
      config.foo = 1;
      config.extends = ['invalid-preset', 'pinVersions'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves group with parent description', () => {
      config.extends = ['groupJest'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves app preset', () => {
      config.extends = ['app'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('combines two package alls', () => {
      config.extends = ['allEslint', 'allStylelint'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves packageRule', () => {
      config.packageRules = [
        {
          extends: ['allEslint'],
          groupName: 'eslint',
        },
      ];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves nested groups', () => {
      config.extends = ['automergeLinters'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
  });
});
