import * as configValidation from '../../lib/config/validation';
import { RenovateConfig } from '../../lib/config';

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
      /** @type any */
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
    it('included unsupported manager', async () => {
      const config = {
        packageRules: [
          {
            managers: ['foo'],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });
    it('included managers of the wrong type', async () => {
      const config = {
        packageRules: [
          {
            managers: 'string not an array',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
    it('errors for all types', async () => {
      const config: RenovateConfig = {
        allowedVersions: 'foo',
        enabled: 1 as any,
        schedule: ['every 15 mins every weekday'],
        timezone: 'Asia',
        labels: 5,
        semanticCommitType: 7 as any,
        lockFileMaintenance: false as any,
        extends: [':timezone(Europe/Brussel)'],
        packageRules: [
          {
            excludePackageNames: ['foo'],
            enabled: true,
          },
          {
            foo: 1,
          },
          'what?' as any,
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
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });

    it('validates regEx for each fileMatch', async () => {
      const config = {
        fileMatch: ['js', '***$}{]]['],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });
  });
});
