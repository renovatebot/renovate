const configValidation = require('../../lib/config/validation.js');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns deprecation warnings', async () => {
      const config = {
        prTitle: 'something',
      };
      const { warnings } = await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(1);
      expect(warnings).toMatchSnapshot();
    });
    it('returns nested errors', async () => {
      const config = {
        foo: 1,
        schedule: ['after 5pm'],
        timezone: 'Asia/Singapore',
        packageRules: [
          {
            packagePatterns: ['*'],
            excludePackagePatterns: ['(x+x+)+y'],
          },
        ],
        lockFileMaintenance: {
          bar: 2,
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(3);
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
          {
            packagePatterns: 'abc ([a-z]+) ([a-z]+))',
            excludePackagePatterns: ['abc ([a-z]+) ([a-z]+))'],
            enabled: false,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(12);
    });
    it('selectors outside packageRules array trigger errors', async () => {
      const config = {
        packageNames: ['angular'],
        meteor: {
          packageRules: [
            {
              packageNames: ['meteor'],
            },
          ],
        },
        docker: {
          minor: {
            packageNames: ['testPackage'],
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(2);
    });
    it('ignore packageRule nesting validation for presets', async () => {
      const config = {
        description: ['All angular.js packages'],
        packageNames: [
          'angular',
          'angular-animate',
          'angular-scroll',
          'angular-sanitize',
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(0);
    });
    it('errors for unsafe fileMatches', async () => {
      const config = {
        npm: {
          fileMatch: ['abc ([a-z]+) ([a-z]+))'],
        },
        docker: {
          fileMatch: ['(x+x+)+y'],
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
  });
});
