const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  getWarnings,
  getErrors,
} = require('../../../../../lib/workers/repository/onboarding/pr/errors-warnings');

describe('workers/repository/onboarding/pr/errors-warnings', () => {
  describe('getWarnings()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('returns warning text', () => {
      config.warnings = [
        {
          depName: 'foo',
          message: 'Failed to look up dependency',
        },
      ];
      const res = getWarnings(config);
      expect(res).toMatchSnapshot();
    });
  });
  describe('getErrors()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('returns error text', () => {
      config.errors = [
        {
          depName: 'renovate.json',
          message: 'Failed to parse',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchSnapshot();
    });
  });
});
