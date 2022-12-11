import type { RenovateConfig } from './types';
import * as configValidation from './validation';

describe('config/validation', () => {
  describe('getParentName()', () => {
    it('ignores encrypted in root', () => {
      expect(configValidation.getParentName('encrypted')).toBeEmptyString();
    });

    it('handles array types', () => {
      expect(configValidation.getParentName('hostRules[1]')).toBe('hostRules');
    });

    it('handles encrypted within array types', () => {
      expect(configValidation.getParentName('hostRules[0].encrypted')).toBe(
        'hostRules'
      );
    });
  });

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
            matchPackageNames: ['foo'],
            allowedVersions: '/^2/',
          },
          {
            matchPackageNames: ['bar'],
            allowedVersions: '/***$}{]][/',
          },
          {
            matchPackageNames: ['baz'],
            allowedVersions: '!/^2/',
          },
          {
            matchPackageNames: ['quack'],
            allowedVersions: '!/***$}{]][/',
          },
        ],
      };
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });

    it('catches invalid matchCurrentValue', async () => {
      const config = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            matchCurrentValue: '/^2/',
            enabled: true,
          },
          {
            matchPackageNames: ['bar'],
            matchCurrentValue: '^1',
            enabled: true,
          },
          {
            matchPackageNames: ['quack'],
            matchCurrentValue: '<1.0.0',
            enabled: true,
          },
        ],
      };
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toHaveLength(2);
    });

    it('catches invalid matchCurrentVersion regex', async () => {
      const config = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            matchCurrentVersion: '/^2/',
            enabled: true,
          },
          {
            matchPackageNames: ['bar'],
            matchCurrentVersion: '/***$}{]][/',
            enabled: true,
          },
          {
            matchPackageNames: ['baz'],
            matchCurrentVersion: '!/^2/',
            enabled: true,
          },
          {
            matchPackageNames: ['quack'],
            matchCurrentVersion: '!/***$}{]][/',
            enabled: true,
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
            matchPackagePatterns: ['*'],
            excludePackagePatterns: ['abc ([a-z]+) ([a-z]+))'],
            enabled: true,
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
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(3);
      expect(errors).toMatchSnapshot();
    });

    it('included unsupported manager', async () => {
      const config = {
        packageRules: [
          {
            matchManagers: ['foo'],
            enabled: true,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('ansible');
    });

    it('included managers of the wrong type', async () => {
      const config = {
        packageRules: [
          {
            matchManagers: 'string not an array',
            enabled: true,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });

    it.each([
      ['empty configuration', {}],
      ['configuration with enabledManagers empty', { enabledManagers: [] }],
      ['single enabled manager', { enabledManagers: ['npm'] }],
      [
        'multiple enabled managers',
        { enabledManagers: ['npm', 'gradle', 'maven'] },
      ],
    ])('validates enabled managers for %s', async (_case, config) => {
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it.each([
      ['single not supported manager', { enabledManagers: ['foo'] }],
      ['multiple not supported managers', { enabledManagers: ['foo', 'bar'] }],
      [
        'combined supported and not supported managers',
        { enabledManagers: ['foo', 'npm', 'gradle', 'maven'] },
      ],
    ])(
      'errors if included not supported enabled managers for %s',
      async (_case, config) => {
        const { warnings, errors } = await configValidation.validateConfig(
          config
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
        expect(errors).toMatchSnapshot();
      }
    );

    it('errors for all types', async () => {
      const config: RenovateConfig = {
        allowedVersions: 'foo',
        enabled: 1 as any,
        enabledManagers: ['npm'],
        schedule: ['every 15 mins every weekday'],
        timezone: 'Asia',
        labels: 5 as any,
        prCommitsPerRunLimit: false as any,
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
            matchPackagePatterns: 'abc ([a-z]+) ([a-z]+))',
            excludePackagePatterns: ['abc ([a-z]+) ([a-z]+))'],
            enabled: false,
          },
        ],
        major: null,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(1);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(13);
    });

    it('selectors outside packageRules array trigger errors', async () => {
      const config = {
        matchPackageNames: ['angular'],
        meteor: {
          packageRules: [
            {
              matchPackageNames: ['meteor'],
              enabled: true,
            },
          ],
        },
        docker: {
          minor: {
            matchPackageNames: ['testPackage'],
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toHaveLength(2);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(2);
    });

    it('ignore packageRule nesting validation for presets', async () => {
      const config = {
        description: ['All angular.js packages'],
        matchPackageNames: [
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
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors for unsafe fileMatches', async () => {
      const config = {
        npm: {
          fileMatch: ['abc ([a-z]+) ([a-z]+))'],
        },
        dockerfile: {
          fileMatch: ['x?+'],
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });

    describe('customManagers/regex', () => {
      it('validates regEx for each fileMatch', async () => {
        const config = {
          customManagers: [
            {
              fileMatch: ['js', '***$}{]]['],
              matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
              datasourceTemplate: 'maven',
              versioningTemplate: 'gradle',
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
        expect(errors).toEqual([
          {
            message:
              'Invalid regExp for customManagers[0].fileMatch: `***$}{]][`',
            topic: 'Configuration Error',
          },
        ]);
      });

      it('errors if no matchStrings', async () => {
        const config = {
          customManagers: [
            {
              fileMatch: [],
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config as any,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
        expect(errors).toEqual([
          {
            message:
              'Each Regex Manager must contain a non-empty fileMatch array',
            topic: 'Configuration Error',
          },
        ]);
      });

      it('errors if empty matchStrings', async () => {
        const config = {
          customManagers: [
            {
              fileMatch: ['foo'],
              matchStrings: [],
            },
            {
              fileMatch: ['foo'],
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config as RenovateConfig,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(2);
        expect(errors).toEqual([
          {
            message:
              'Each Regex Manager must contain a non-empty matchStrings array',
            topic: 'Configuration Error',
          },
          {
            message:
              'Each Regex Manager must contain a non-empty matchStrings array',
            topic: 'Configuration Error',
          },
        ]);
      });

      it('errors if no fileMatch', async () => {
        const config = {
          customManagers: [
            {
              matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
              datasourceTemplate: 'maven',
              versioningTemplate: 'gradle',
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config as any,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
      });

      it('validates regEx for each matchStrings', async () => {
        const config = {
          customManagers: [
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
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
      });

      it('passes if all fields are present', async () => {
        const config = {
          customManagers: [
            {
              fileMatch: ['Dockerfile'],
              matchStrings: ['ENV (?<currentValue>.*?)\\s'],
              depNameTemplate: 'foo',
              datasourceTemplate: 'bar',
              registryUrlTemplate: 'foobar',
              extractVersionTemplate: '^(?<version>v\\d+\\.\\d+)',
              depTypeTemplate: 'apple',
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('errors if extra fields are present', async () => {
        const config = {
          customManagers: [
            {
              fileMatch: ['Dockerfile'],
              matchStrings: ['ENV (?<currentValue>.*?)\\s'],
              depNameTemplate: 'foo',
              datasourceTemplate: 'bar',
              depTypeTemplate: 'apple',
              automerge: true,
            },
          ],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          config,
          true
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toHaveLength(1);
      });

      it('errors if mandatory fields are missing', async () => {
        const config = {
          customManagers: [
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
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            message:
              'Regex Managers must contain currentValueTemplate configuration or regex group named currentValue',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toHaveLength(1);
      });
    });

    it('ignore keys', async () => {
      const config = {
        $schema: 'renovate.json',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates timezone preset', async () => {
      const config = {
        extends: [':timezone', ':timezone(Europe/Berlin)'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('does not validate constraints children', async () => {
      const config = {
        constraints: { packageRules: [{}] },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as never, // TODO: #15963
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates object with ignored children', async () => {
      const config = {
        prBodyDefinitions: {},
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates valid registryAlias objects', async () => {
      const config = {
        registryAliases: {
          example1: 'http://www.example.com',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors if registryAliases depth is more than 1', async () => {
      const config = {
        registryAliases: {
          sample: {
            example1: 'http://www.example.com',
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toEqual([
        {
          message:
            'Invalid `registryAliases.registryAliases.sample` configuration: value is not a url',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if registryAliases have invalid url', async () => {
      const config = {
        registryAliases: {
          example1: 'noturl',
          example2: 'http://www.example.com',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toEqual([
        {
          message:
            'Invalid `registryAliases.registryAliases.example1` configuration: value is not a url',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if fileMatch has wrong parent', async () => {
      const config = {
        fileMatch: ['foo'],
        npm: {
          fileMatch: ['package\\.json'],
          minor: {
            fileMatch: ['bar'],
          },
        },
        customManagers: [
          {
            fileMatch: ['build.gradle'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(errors).toEqual([
        {
          message:
            '"fileMatch" may not be defined at the top level of a config and must instead be within a manager block',
          topic: 'Config error',
        },
      ]);
      expect(warnings).toEqual([
        {
          message:
            '"fileMatch" must be configured in a manager block and not here: npm.minor',
          topic: 'Config warning',
        },
      ]);
    });

    it('errors if language or manager objects are nested', async () => {
      const config = {
        python: {
          enabled: false,
        },
        java: {
          gradle: {
            enabled: false,
          },
        },
        major: {
          minor: {
            docker: {
              automerge: true,
            },
          },
        },
      } as never;
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(errors).toHaveLength(2);
      expect(warnings).toBeEmptyArray();
      expect(errors).toEqual([
        {
          message:
            'The "docker" object can only be configured at the top level of a config but was found inside "major.minor"',
          topic: 'Configuration Error',
        },
        {
          message:
            'The "gradle" object can only be configured at the top level of a config but was found inside "java"',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('warns if hostType has the wrong parent', async () => {
      const config = {
        hostType: 'npm',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toHaveLength(1);
      expect(warnings).toEqual([
        {
          message:
            'hostType should only be configured within a "hostRules" object. Was found in .',
          topic: 'hostType',
        },
      ]);
    });

    it('validates preset values', async () => {
      const config = {
        extends: ['foo', 'bar', 42] as never,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(1);
    });

    it('warns if only selectors in packageRules', async () => {
      const config = {
        packageRules: [
          { matchDepTypes: ['foo'], excludePackageNames: ['bar'] },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toHaveLength(1);
      expect(warnings).toEqual([
        {
          message:
            'packageRules[0]: Each packageRule must contain at least one non-match* or non-exclude* field. Rule: {"matchDepTypes":["foo"],"excludePackageNames":["bar"]}',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('errors if invalid combinations in packageRules', async () => {
      const config = {
        packageRules: [
          {
            matchUpdateTypes: ['major'],
            registryUrls: ['https://registry.npmjs.org'],
          },
        ],
      } as any;
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toHaveLength(1);
      expect(errors).toEqual([
        {
          message:
            'packageRules[0]: packageRules cannot combine both matchUpdateTypes and registryUrls. Rule: {"matchUpdateTypes":["major"],"registryUrls":["https://registry.npmjs.org"]}',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('warns on nested group packageRules', async () => {
      const config = {
        extends: ['group:fortawesome'],
        packageRules: [
          {
            automerge: true,
            extends: ['group:fortawesome'],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toHaveLength(1);
    });

    it('validates valid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors on invalid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 123,
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toEqual([
        {
          message:
            'Invalid `customEnvVariables.customEnvVariables.example2` configuration: value is not a string',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if schedule is cron and has no * minutes', async () => {
      const config = {
        schedule: ['30 5 * * *'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toEqual([
        {
          message:
            'Invalid schedule: `Invalid schedule: "30 5 * * *" has cron syntax, but doesn\'t have * as minutes`',
          topic: 'Configuration Error',
        },
      ]);
    });
  });
});
