const configValidation = require('../../lib/config/validation.js');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns nested errors', () => {
      const config = {
        foo: 1,
        prBody: 'some-body',
        lockFileMaintenance: {
          bar: 2,
        },
      };
      const errors = configValidation.validateConfig(config);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
    it('errors for all types', () => {
      const config = {
        enabled: 1,
        schedule: 'after 5pm',
        semanticPrefix: 7,
        githubAppId: 'none',
        lockFileMaintenance: false,
      };
      const errors = configValidation.validateConfig(config);
      expect(errors).toHaveLength(5);
      expect(errors).toMatchSnapshot();
    });
  });
});
