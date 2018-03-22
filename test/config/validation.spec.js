const configValidation = require('../../lib/config/validation.js');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns nested errors', () => {
      const config = {
        foo: 1,
        schedule: ['after 5pm'],
        timezone: 'Asia/Singapore',
        npmrc: 'foo=bar',
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
        allowedVersions: 'foo',
        enabled: 1,
        schedule: ['every 15 mins every weekday'],
        timezone: 'Asia',
        npmrc: 'foo:bar',
        labels: 5,
        semanticCommitType: 7,
        lockFileMaintenance: false,
        extends: [':timezone(Europe/Brussel)'],
        packageRules: [
          {
            foo: 1,
          },
        ],
      };
      const { warnings, errors } = configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(10);
      expect(errors).toMatchSnapshot();
    });
  });
});
