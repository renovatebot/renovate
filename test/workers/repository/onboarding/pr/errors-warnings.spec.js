const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  getWarnings,
  getErrors,
  getDepWarnings,
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
  describe('getDepWarnings()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns warning text', () => {
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1' }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1' }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2' }],
              },
            ],
          },
        ],
      };
      const res = getDepWarnings(packageFiles);
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
