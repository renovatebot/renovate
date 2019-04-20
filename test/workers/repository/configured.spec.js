const {
  checkIfConfigured,
} = require('../../../lib/workers/repository/configured');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../config/config/_fixtures') };
});

describe('workers/repository/configured', () => {
  describe('checkIfConfigured()', () => {
    it('returns', () => {
      checkIfConfigured(config);
    });
    it('throws if disabled', () => {
      config.enabled = false;
      expect(() => checkIfConfigured(config)).toThrow();
    });
    it('throws if unconfigured fork', () => {
      config.enabled = true;
      config.isFork = true;
      config.renovateJsonPresent = false;
      expect(() => checkIfConfigured(config)).toThrow();
    });
  });
});
