import * as configValidation from './validation';
import { RenovateConfig } from '.';

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
    it('catches invalid templates', async () => {
      const config = {
        commitMessage: '{{{something}}',
      };
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });
    it('catches invalid allowedVersions regex', async () => {
      const config = {
        packageRules: [
          {
            packageNames: ['foo'],
            allowedVersions: '/^2/',
          },
          {
            packageNames: ['bar'],
            allowedVersions: '/***$}{]][/',
          },
          {
            packageNames: ['baz'],
            allowedVersions: '!/^2/',
          },
          {
            packageNames: ['quack'],
            allowedVersions: '!/***$}{]][/',
          },
        ],
      };
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
    it('returns nested errors', async () => {
      const config: RenovateConfig = {
        foo: 1,
        schedule: ['after 5pm'],
        timezone: 'Asia/Singapore',
        packageRules: [
          {
            packagePatterns: ['*'],
            excludePackagePatterns: ['abc ([a-z]+) ([a-z]+))'],
          },
        ],
        lockFileMaintenance: {
          bar: 2,
        },
        major: null,
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
      expect(errors[0].message).toContain('ansible');
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
        labels: 5 as any,
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
        major: null,
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
          fileMatch: ['x?+'],
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
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
    it('errors if no regexManager matchStrings', async () => {
      const config = {
        regexManagers: [
          {
            fileMatch: [],
            matchStrings: [],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });
    it('validates regEx for each matchStrings', async () => {
      const config = {
        regexManagers: [
          {
            fileMatch: ['Dockerfile'],
            matchStrings: ['***$}{]]['],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });
    it('passes if regexManager fields are present', async () => {
      const config = {
        regexManagers: [
          {
            fileMatch: ['Dockerfile'],
            matchStrings: ['ENV (?<currentValue>.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
    it('errors if extra regexManager fields are present', async () => {
      const config = {
        regexManagers: [
          {
            fileMatch: ['Dockerfile'],
            matchStrings: ['ENV (?<currentValue>.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            automerge: true,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });
    it('errors if regexManager fields are missing', async () => {
      const config = {
        regexManagers: [
          {
            fileMatch: ['Dockerfile'],
            matchStrings: ['ENV (.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(1);
    });
    it('ignore keys', async () => {
      const config = {
        $schema: 'renovate.json',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('validates timezone preset', async () => {
      const config = {
        extends: [':timezone', ':timezone(Europe/Berlin)'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('does not validate constraints children', async () => {
      const config = {
        constraints: { packageRules: [{}] },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('validates object with ignored children', async () => {
      const config = {
        prBodyDefinitions: {},
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('validates valid alias objects', async () => {
      const config = {
        aliases: {
          example1: 'http://www.example.com',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
      expect(errors).toMatchSnapshot();
    });

    it('errors if aliases depth is more than 1', async () => {
      const config = {
        aliases: {
          sample: {
            example1: 'http://www.example.com',
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });

    it('errors if aliases have invalid url', async () => {
      const config = {
        aliases: {
          example1: 'noturl',
          example2: 'http://www.example.com',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });
  });
});
