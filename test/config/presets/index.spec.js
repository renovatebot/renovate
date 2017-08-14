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
      config.extends = ['packages/eslint', 'packages/stylelint'];
      const res = presets.resolveConfigPresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves packageRule', () => {
      config.packageRules = [
        {
          extends: ['packages/eslint'],
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
