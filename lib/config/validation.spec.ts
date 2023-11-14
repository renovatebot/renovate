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
        'hostRules',
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

    it('catches invalid customDatasources content', async () => {
      const config = {
        customDatasources: {
          foo: {
            randomKey: '',
            defaultRegistryUrlTemplate: [],
            transformTemplates: [{}],
          },
        },
      } as any;
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `customDatasources.customDatasources.defaultRegistryUrlTemplate` configuration: is a string',
        },
        {
          message:
            'Invalid `customDatasources.customDatasources.randomKey` configuration: key is not allowed',
        },
        {
          message:
            'Invalid `customDatasources.customDatasources.transformTemplates` configuration: is not an array of string',
        },
      ]);
    });

    it('catches invalid customDatasources record type', async () => {
      const config = {
        customDatasources: {
          randomKey: '',
        },
      } as any;
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `customDatasources.randomKey` configuration: customDatasource is not an object',
        },
      ]);
    });

    it('catches invalid baseBranches regex', async () => {
      const config = {
        baseBranches: ['/***$}{]][/'],
      };
      const { errors } = await configValidation.validateConfig(config);
      expect(errors).toEqual([
        {
          topic: 'Configuration Error',
          message: 'Invalid regExp for baseBranches: `/***$}{]][/`',
        },
      ]);
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
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
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
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
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
        config as any,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });

    it.each([
      ['empty configuration', {}],
      ['configuration with enabledManagers empty', { enabledManagers: [] }],
      ['single enabled manager', { enabledManagers: ['npm'] }],
      [
        'multiple enabled managers',
        {
          enabledManagers: ['npm', 'gradle', 'maven', 'custom.regex'],
        },
      ],
    ])('validates enabled managers for %s', async (_case, config) => {
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
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
        const { warnings, errors } =
          await configValidation.validateConfig(config);
        expect(warnings).toHaveLength(0);
        expect(errors).toHaveLength(1);
        expect(errors).toMatchSnapshot();
      },
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
            matchDepPatterns: 'abc ([a-z]+) ([a-z]+))',
            matchPackagePatterns: 'abc ([a-z]+) ([a-z]+))',
            excludeDepPatterns: ['abc ([a-z]+) ([a-z]+))'],
            excludePackagePatterns: ['abc ([a-z]+) ([a-z]+))'],
            enabled: false,
          },
        ],
        major: null,
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(1);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(15);
    });

    it('selectors outside packageRules array trigger errors', async () => {
      const config = {
        matchDepNames: ['angular'],
        matchPackageNames: ['angular'],
        meteor: {
          packageRules: [
            {
              matchDepNames: ['meteor'],
              matchPackageNames: ['meteor'],
              enabled: true,
            },
          ],
        },
        ansible: {
          minor: {
            matchDepNames: ['meteor'],
            matchPackageNames: ['testPackage'],
          },
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(4);
      expect(errors).toMatchSnapshot();
      expect(errors).toHaveLength(4);
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
        true,
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
        dockerfile: {
          fileMatch: ['x?+'],
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });

    it('validates regEx for each fileMatch', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
    });

    it('errors if customManager has empty fileMatch', async () => {
      const config = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: [],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as any,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Each Custom Manager must contain a non-empty fileMatch array",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if no customManager customType', async () => {
      const config = {
        customManagers: [
          {
            fileMatch: ['some-file'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as any,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Each Custom Manager must contain a non-empty customType string",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if invalid customManager customType', async () => {
      const config = {
        customManagers: [
          {
            customType: 'unknown',
            fileMatch: ['some-file'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as any,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Invalid customType: unknown. Key is not a custom manager",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if empty customManager matchStrings', async () => {
      const config = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['foo'],
            matchStrings: [],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
          {
            customType: 'regex',
            fileMatch: ['foo'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as RenovateConfig,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Each Custom Manager must contain a non-empty matchStrings array",
            "topic": "Configuration Error",
          },
          {
            "message": "Each Custom Manager must contain a non-empty matchStrings array",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if no customManager fileMatch', async () => {
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
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    it('validates regEx for each matchStrings', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['Dockerfile'],
            matchStrings: ['***$}{]]['],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    // testing if we get all errors at once or not (possible), this does not include customType or fileMatch
    // since they are common to all custom managers
    it('validates all possible regex manager options', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['Dockerfile'],
            matchStrings: ['***$}{]]['], // invalid matchStrings regex, no depName, datasource and currentValue
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(4);
    });

    it('passes if customManager fields are present', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
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
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('errors if extra customManager fields are present', async () => {
      const config = {
        customManagers: [
          {
            customType: 'regex',
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
        config as any,
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    it('errors if customManager fields are missing', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['Dockerfile'],
            matchStrings: ['ENV (.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true,
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
        true,
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
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('does not validate constraints children', async () => {
      const config = {
        constraints: { packageRules: [{}] },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config as never, // TODO: #15963
        true,
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
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('validates valid registryAlias objects', async () => {
      const config = {
        registryAliases: {
          example1: 'http://www.example.com',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('errors if registryAliases depth is more than 1', async () => {
      const config = {
        registryAliases: {
          sample: {
            example1: 'http://www.example.com',
          } as unknown as string, // intentional incorrect config to check error message
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `registryAliases.registryAliases.sample` configuration: value is not a string',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if registryAliases have invalid value', async () => {
      const config = {
        registryAliases: {
          example1: 123 as never,
          example2: 'http://www.example.com',
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `registryAliases.registryAliases.example1` configuration: value is not a string',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if fileMatch has wrong parent', async () => {
      const config: RenovateConfig = {
        fileMatch: ['foo'],
        npm: {
          fileMatch: ['package\\.json'],
          minor: {
            fileMatch: ['bar'],
          },
        },
        customManagers: [
          {
            customType: 'regex',
            fileMatch: ['build.gradle'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(errors).toMatchSnapshot();
      expect(warnings).toMatchSnapshot();
    });

    it('errors if manager objects are nested', async () => {
      const config = {
        pyenv: {
          enabled: false,
        },
        maven: {
          gradle: {
            enabled: false,
          },
        },
      } as never;
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchSnapshot();
    });

    it('warns if hostType has the wrong parent', async () => {
      const config = {
        hostType: 'npm',
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings).toMatchSnapshot();
    });

    it('validates preset values', async () => {
      const config = {
        extends: ['foo', 'bar', 42] as never,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        config,
        true,
      );
      expect(warnings).toHaveLength(0);
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
        true,
      );
      expect(warnings).toHaveLength(1);
      expect(warnings).toMatchSnapshot();
      expect(errors).toHaveLength(0);
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
        true,
      );
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors).toMatchSnapshot();
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
        true,
      );
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(1);
    });

    it('validates valid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('errors on invalid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 123,
        },
      };
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchObject([
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
      const { warnings, errors } =
        await configValidation.validateConfig(config);
      expect(warnings).toHaveLength(0);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid schedule: `Invalid schedule: "30 5 * * *" has cron syntax, but doesn\'t have * as minutes`',
          topic: 'Configuration Error',
        },
      ]);
    });
  });
});
