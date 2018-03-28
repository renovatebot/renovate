const configValidation = require('../../lib/config/validation.js');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns nested errors', async () => {
      const config = {
        foo: 1,
        schedule: ['after 5pm'],
        timezone: 'Asia/Singapore',
        prBody: 'some-body',
        lockFileMaintenance: {
          bar: 2,
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
    it('errors for all types', async () => {
      const config = {
        allowedVersions: 'foo',
        enabled: 1,
        schedule: ['every 15 mins every weekday'],
        timezone: 'Asia',
        labels: 5,
        semanticCommitType: 7,
        lockFileMaintenance: false,
        extends: [':timezone(Europe/Brussel)'],
        packageRules: [
          {
            excludePackageNames: ['foo'],
            enabled: true,
          },
          {
            foo: 1,
          },
          'what?',
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toMatchSnapshot();
      expect(warnings).toHaveLength(1);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(10);
    });
  });
});
