const {
  checkIfConfigured,
} = require('../../../lib/workers/repository/configured');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../_fixtures/config') };
});

describe('workers/repository/configured', () => {
  describe('checkIfConfigured()', () => {
    it('returns', () => {
      checkIfConfigured(config);
    });
    it('throws if disabled', () => {
      config.enabled = false;
      let e;
      try {
        checkIfConfigured(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('throws if unconfigured fork', () => {
      config.enabled = true;
      config.isFork = true;
      config.renovateJsonPresent = false;
      let e;
      try {
        checkIfConfigured(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
});
