const presets = require('../../lib/config/presets');
const logger = require('../_fixtures/logger');

describe('config/presets', () => {
  describe('resolvePreset', () => {
    let config;
    beforeEach(() => {
      config = {
        logger,
      };
    });
    it('returns same if no presets', () => {
      config.foo = 1;
      config.presets = [];
      const res = presets.resolvePresets(config);
      expect(config).toMatchObject(res);
      expect(res).toMatchSnapshot();
    });
    it('returns same if invalid preset', () => {
      config.foo = 1;
      config.presets = ['invalid-preset'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('works with vaid and invalid', () => {
      config.foo = 1;
      config.presets = ['invalid-preset', 'pinVersions'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
    it('resolves app preset', () => {
      config.presets = ['app'];
      const res = presets.resolvePresets(config);
      expect(res).toMatchSnapshot();
    });
  });
});
