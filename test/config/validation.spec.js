const configValidation = require('../../lib/config/validation.js');
const logger = require('../_fixtures/logger');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns nested errors', () => {
      const config = {
        foo: 1,
        schedule: ['after 5pm'],
        prBody: 'some-body',
        lockFileMaintenance: {
          bar: 2,
        },
      };
      const { warnings, errors } = configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
    it('errors for all types', () => {
      const config = {
        enabled: 1,
        schedule: ['every 15 mins every weekday'],
        labels: 5,
        semanticPrefix: 7,
        githubAppId: 'none',
        lockFileMaintenance: false,
        packageRules: [
          {
            foo: 1,
          },
        ],
      };
      const { warnings, errors } = configValidation.validateConfig(
        config,
        logger
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(7);
      expect(errors).toMatchSnapshot();
    });
  });
});
