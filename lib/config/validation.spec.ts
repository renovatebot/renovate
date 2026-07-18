import { partial } from '~test/util.ts';
import type { HostRule } from '../types/index.ts';
import { getConfigFileNames } from './app-strings.ts';
import { GlobalConfig } from './global.ts';
import type { AllConfig, RenovateConfig } from './types.ts';
import * as configValidation from './validation.ts';

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it.each([
      [
        'branchName',
        `Direct editing of branchName is now deprecated. Please edit branchPrefix, additionalBranchPrefix, or branchTopic instead`,
      ],
      [
        'commitMessage',
        `Direct editing of commitMessage is now deprecated. Please edit commitMessage's subcomponents instead.`,
      ],
      [
        'prTitle',
        `Direct editing of prTitle is now deprecated. Please edit commitMessage subcomponents instead as they will be passed through to prTitle.`,
      ],
    ])(
      `returns custom deprecation warnings for %s`,
      async (option, message) => {
        const config = {
          [option]: 'something',
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
        );
        expect(warnings).toMatchObject([
          {
            topic: 'Deprecation Warning',
            message,
          },
        ]);
        expect(errors).toBeEmptyArray();
      },
    );

    // NOTE that this should always refer to a deprecated option, but at some point, we may have removed them all, so we'll need to think about how to handle that, at that point
    it('returns the deprecationMsg for `dnsCache` as a warning', async () => {
      const config: RenovateConfig = {
        hostRules: [
          {
            dnsCache: true,
          } as HostRule,
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          topic: 'Deprecation Warning',
          message: `The 'dnsCache' option is deprecated: This option is deprecated and will be removed in a future release.`,
        },
      ]);
    });

    it('allow enabled field in vulnerabilityAlerts', async () => {
      const config = {
        vulnerabilityAlerts: {
          enabled: false,
        },
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });

    it('catches global options in repo config', async () => {
      const config = {
        binarySource: 'something',
        username: 'user',
        ignorePrAuthor: true,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error -- invalid config
        config,
      );
      expect(warnings).toMatchObject([
        {
          message: `The "binarySource" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
        {
          message: `The "ignorePrAuthor" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
        {
          message: `The "username" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('catches global options in inherit config', async () => {
      const config = {
        binarySource: 'something',
        username: 'user',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'inherit',
        // @ts-expect-error -- invalid config
        config,
      );
      expect(warnings).toMatchObject([
        {
          message: `The "binarySource" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
        {
          message: `The "username" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('only warns for actual globals in repo config', async () => {
      const config = {
        hostRules: [
          {
            username: 'user',
            token: 'token',
            password: 'pass',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('does not warn for valid inheritConfig', async () => {
      const config = {
        onboarding: false,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'inherit',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('catches invalid templates', async () => {
      const config = {
        commitMessage: '{{{something}}',
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message: 'Invalid template in config path: commitMessage',
        },
      ]);
      expect(warnings).toMatchObject([
        {
          message: `Direct editing of commitMessage is now deprecated. Please edit commitMessage's subcomponents instead.`,
        },
      ]);
    });

    it('accepts templates referencing runtime-only fields', async () => {
      const config = {
        packageRules: [
          {
            matchPackageNames: ['rabbitmq'],
            allowedVersions: '<{{add major 1}}',
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });

    it('catches invalid jsonata expressions', async () => {
      const config = {
        packageRules: [
          {
            matchJsonata: ['packageName = "foo"', '{{{something wrong}'],
            enabled: true,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message: expect.stringContaining('Invalid JSONata expression'),
        },
      ]);
      expect(warnings).toBeEmptyArray();
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
          {
            matchPackageNames: ['quack'],
            allowedVersions: '/quaCk/i',
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Invalid regExp for packageRules[1].allowedVersions: `/***$}{]][/`',
        },
        {
          message:
            'Invalid regExp for packageRules[3].allowedVersions: `!/***$}{]][/`',
        },
      ]);
      expect(warnings).toBeEmptyArray();
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
          {
            matchPackageNames: ['foo'],
            matchCurrentValue: '/^2/i',
            enabled: true,
          },
          {
            matchPackageNames: ['bad'],
            matchNewValue: '/^2(/',
            enabled: true,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message: 'Invalid regExp for packageRules[4].matchNewValue: `/^2(/`',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches invalid matchNewValue', async () => {
      const config = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            matchNewValue: '/^2/',
            enabled: true,
          },
          {
            matchPackageNames: ['bar'],
            matchNewValue: '^1',
            enabled: true,
          },
          {
            matchPackageNames: ['quack'],
            matchNewValue: '<1.0.0',
            enabled: true,
          },
          {
            matchPackageNames: ['foo'],
            matchNewValue: '/^2/i',
            enabled: true,
          },
          {
            matchPackageNames: ['bad'],
            matchNewValue: '/^2(/',
            enabled: true,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message: 'Invalid regExp for packageRules[4].matchNewValue: `/^2(/`',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates matchBaseBranches', async () => {
      const config = {
        baseBranchPatterns: ['foo'],
        packageRules: [
          {
            matchBaseBranches: ['foo'],
            addLabels: ['foo'],
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });

    it('catches invalid matchBaseBranches when baseBranchPatterns is not defined', async () => {
      const config = {
        packageRules: [
          {
            matchBaseBranches: ['foo'],
            addLabels: ['foo'],
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          topic: 'Configuration Error',
          message:
            'packageRules[0]: You must configure baseBranchPatterns in order to use them inside matchBaseBranches.',
        },
      ]);
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
          {
            matchPackageNames: ['foo'],
            matchCurrentVersion: '/^2/i',
            enabled: true,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Invalid regExp for packageRules[1].matchCurrentVersion: `/***$}{]][/`',
        },
        {
          message:
            'Invalid regExp for packageRules[3].matchCurrentVersion: `!/***$}{]][/`',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches invalid customDatasources content', async () => {
      // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid customDatasources content
      const config = {
        customDatasources: {
          foo: {
            description: 3,
            randomKey: '',
            defaultRegistryUrlTemplate: [],
            transformTemplates: [{}],
          },
          bar: {
            description: 'foo',
            defaultRegistryUrlTemplate: 'bar',
            transformTemplates: ['foo = "bar"', 'bar[0'],
          },
        },
      } as any;
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `customDatasources.defaultRegistryUrlTemplate` configuration: is a string',
        },
        {
          message:
            'Invalid `customDatasources.description` configuration: is not an array of strings',
        },
        {
          message:
            'Invalid `customDatasources.randomKey` configuration: key is not allowed',
        },
        {
          message:
            'Invalid `customDatasources.transformTemplates` configuration: is not an array of string',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates invalid statusCheckNames', async () => {
      const config = {
        statusCheckNames: {
          randomKey: '',
          mergeConfidence: 10,
          configValidation: '',
          artifactError: null,
        },
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error invalid options
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `statusCheckNames.mergeConfidence` configuration: status check is not a string.',
        },
        {
          message:
            'Invalid `statusCheckNames.statusCheckNames.randomKey` configuration: key is not allowed.',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates invalid statusCheckWhen', async () => {
      const config = {
        statusCheckWhen: {
          randomKey: 'always',
          mergeConfidence: 'invalid',
          artifactError: 'always',
        },
      };
      // @ts-expect-error invalid options
      const { errors } = await configValidation.validateConfig('repo', config);
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `statusCheckWhen.mergeConfidence` configuration: value must be one of "always", "never", or "failed".',
        },
        {
          message:
            'Invalid `statusCheckWhen.statusCheckWhen.randomKey` configuration: key is not allowed.',
        },
      ]);
      expect(errors).toHaveLength(2);
    });

    it('catches invalid customDatasources record type', async () => {
      // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid customDatasources record type
      const config = {
        customDatasources: {
          randomKey: '',
        },
      } as any;
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `customDatasources.randomKey` configuration: customDatasource is not an object',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches invalid baseBranchPatterns regex', async () => {
      const config = {
        baseBranchPatterns: ['/***$}{]][/', '/branch/i'],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toEqual([
        {
          topic: 'Configuration Error',
          message:
            'Failed to parse regex pattern for baseBranchPatterns: /***$}{]][/',
        },
        {
          topic: 'Configuration Error',
          message: 'Invalid regExp for baseBranchPatterns: `/***$}{]][/`',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('returns nested errors', async () => {
      const config: RenovateConfig = {
        foo: 1,
        schedule: ['after 5pm'],
        timezone: 'Asia/Singapore',
        packageRules: [
          {
            matchPackageNames: [
              '*',
              '/abc ([a-z]+) ([a-z]+))/',
              '!/abc ([a-z]+) ([a-z]+))/',
            ],
            enabled: true,
          },
        ],
        lockFileMaintenance: {
          // @ts-expect-error -- testing
          bar: 2,
        },
        major: null,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Failed to parse regex pattern for packageRules[0].matchPackageNames: !/abc ([a-z]+) ([a-z]+))/',
        },
        {
          message:
            'Failed to parse regex pattern for packageRules[0].matchPackageNames: /abc ([a-z]+) ([a-z]+))/',
        },
        {
          message: 'Invalid configuration option: foo',
        },
        {
          message: 'Invalid configuration option: lockFileMaintenance.bar',
        },
        {
          message:
            'Invalid regExp for packageRules[0].matchPackageNames: `!/abc ([a-z]+) ([a-z]+))/`',
        },
        {
          message:
            'Invalid regExp for packageRules[0].matchPackageNames: `/abc ([a-z]+) ([a-z]+))/`',
        },
        {
          message:
            'packageRules[0].matchPackageNames: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.',
        },
      ]);
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
        'repo',
        config as any,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Configuration option `packageRules[0].matchManagers` should be a list (Array)',
        },
      ]);
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
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it.each([
      [
        'single not supported manager',
        { enabledManagers: ['foo'] },
        'The following managers configured in enabledManagers are not supported: "foo"',
      ],
      [
        'multiple not supported managers',
        { enabledManagers: ['foo', 'bar'] },
        'The following managers configured in enabledManagers are not supported: "foo, bar"',
      ],
      [
        'combined supported and not supported managers',
        { enabledManagers: ['foo', 'npm', 'gradle', 'maven'] },
        'The following managers configured in enabledManagers are not supported: "foo"',
      ],
    ])(
      'errors if included not supported enabled managers for %s',
      async (_case, config, message) => {
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toMatchObject([{ message }]);
      },
    );

    it('errors for all types', async () => {
      const config: RenovateConfig = {
        // @ts-expect-error - only allowed in package rules
        allowedVersions: 'foo',
        enabled: 1 as any,
        enabledManagers: ['npm'],
        schedule: ['every 15 mins every weekday'],
        timezone: 'Asia',
        labels: 5 as any,
        azureWorkItemId: false as any,
        semanticCommitType: 7 as any,
        lockFileMaintenance: false as any,
        extends: [':timezone(Europe/Brussel)'],
        packageRules: [
          {
            foo: 1,
          },
          'what?' as any,
          {
            matchPackageNames: '/abc ([a-z]+) ([a-z]+))/',
            matchDepNames: ['abc ([a-z]+) ([a-z]+))'],
            enabled: false,
          },
        ],
        major: null,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toMatchObject([
        {
          topic: 'allowedVersions',
          message:
            '"allowedVersions" can\'t be used in ".". Allowed objects: packageRules.',
        },
      ]);
      expect(errors).toMatchObject([
        {
          message:
            'Configuration option `azureWorkItemId` should be an integer. Found: false (boolean).',
        },
        {
          message:
            'Configuration option `enabled` should be boolean. Found: 1 (number)',
        },
        {
          message: 'Configuration option `labels` should be a list (Array)',
        },
        {
          message:
            'Configuration option `lockFileMaintenance` should be a json object',
        },
        {
          message:
            'Configuration option `packageRules[2].matchPackageNames` should be a list (Array)',
        },
        {
          message:
            'Configuration option `semanticCommitType` should be a string',
        },
        {
          message: 'Invalid configuration option: packageRules[0].foo',
        },
        {
          message:
            'Invalid schedule: `Invalid schedule: "every 15 mins every weekday" should not specify minutes`',
        },
        {
          message:
            'extends: Invalid schedule: Unsupported timezone Europe/Brussel',
        },
        {
          message: 'packageRules must contain JSON objects',
        },
        {
          message:
            'packageRules[0]: Each packageRule must contain at least one match* or exclude* selector. Rule: {"foo":1}',
        },
        {
          message: 'timezone: Invalid schedule: Unsupported timezone Asia',
        },
      ]);
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
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error -- TODO: managers, datasources and versionings are not defined on RenovateConfig
        config,
      );
      expect(warnings).toMatchObject([
        {
          topic: 'ansible.minor.matchDepNames',
          message:
            '"matchDepNames" can\'t be used in "minor". Allowed objects: packageRules.',
        },
        {
          topic: 'ansible.minor.matchPackageNames',
          message:
            '"matchPackageNames" can\'t be used in "minor". Allowed objects: packageRules.',
        },
        {
          topic: 'matchDepNames',
          message:
            '"matchDepNames" can\'t be used in ".". Allowed objects: packageRules.',
        },
        {
          topic: 'matchPackageNames',
          message:
            '"matchPackageNames" can\'t be used in ".". Allowed objects: packageRules.',
        },
      ]);
      expect(errors).toMatchObject([
        {
          message:
            'ansible.minor.matchDepNames: matchDepNames should be inside a `packageRule` only',
        },
        {
          message:
            'ansible.minor.matchPackageNames: matchPackageNames should be inside a `packageRule` only',
        },
        {
          message:
            'matchDepNames: matchDepNames should be inside a `packageRule` only',
        },
        {
          message:
            'matchPackageNames: matchPackageNames should be inside a `packageRule` only',
        },
      ]);
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
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors for unsafe managerFilePatterns', async () => {
      const config = {
        npm: {
          managerFilePatterns: ['/abc ([a-z]+) ([a-z]+))/'],
        },
        dockerfile: {
          managerFilePatterns: ['/x?+/'],
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error -- TODO: managers, datasources and versionings are not defined on RenovateConfig
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Failed to parse regex pattern for dockerfile.managerFilePatterns: /x?+/',
        },
        {
          message:
            'Failed to parse regex pattern for npm.managerFilePatterns: /abc ([a-z]+) ([a-z]+))/',
        },
      ]);
    });

    it('validates regEx for each managerFilePatterns of format regex', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['/js/', '/***$}{]][/'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Failed to parse regex pattern for customManagers[0].managerFilePatterns: /***$}{]][/',
        },
      ]);
    });

    it('errors if customManager has empty managerFilePatterns', async () => {
      const config = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: [],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config as any,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Each Custom Manager must contain a non-empty managerFilePatterns array",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if no customManager customType', async () => {
      const config = {
        customManagers: [
          {
            managerFilePatterns: ['some-file'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config as any,
        true,
      );
      expect(warnings).toBeEmptyArray();
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
            managerFilePatterns: ['some-file'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config as any,
        true,
      );
      expect(warnings).toBeEmptyArray();
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
            managerFilePatterns: ['foo'],
            matchStrings: [],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
          {
            customType: 'jsonata',
            fileFormat: 'json',
            managerFilePatterns: ['foo'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config as RenovateConfig,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchInlineSnapshot(`
        [
          {
            "message": "Each Custom Manager \`matchStrings\` array must have at least one item.",
            "topic": "Configuration Error",
          },
          {
            "message": "Each Custom Manager must contain a non-empty matchStrings array",
            "topic": "Configuration Error",
          },
        ]
      `);
    });

    it('errors if no customManager managerFilePatterns', async () => {
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
        'repo',
        config as any,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Each Custom Manager must contain a non-empty customType string',
        },
      ]);
    });

    it('validates regEx for each matchStrings', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['Dockerfile'],
            matchStrings: ['***$}{]]['],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: 'Invalid regExp for customManagers: `***$}{]][`',
        },
      ]);
    });

    it('error if no fileFormat in custom JSONata manager', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'jsonata',
            managerFilePatterns: ['package.json'],
            matchStrings: [
              'packages.{"depName": name, "currentValue": version, "datasource": "npm"}',
            ],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          topic: 'Configuration Error',
          message: 'Each JSONata manager must contain a fileFormat field.',
        },
      ]);
    });

    it('validates JSONata query for each matchStrings', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'jsonata',
            fileFormat: 'json',
            managerFilePatterns: ['package.json'],
            matchStrings: ['packages.{'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            currentValueTemplate: 'baz',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          topic: 'Configuration Error',
          message: `Invalid JSONata query for customManagers: \`packages.{\``,
        },
      ]);
    });

    // testing if we get all errors at once or not (possible), this does not include customType or managerFilePatterns
    // since they are common to all custom managers
    it('validates all possible regex manager options', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['Dockerfile'],
            matchStrings: ['***$}{]]['], // invalid matchStrings regex, no depName, datasource and currentValue
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: 'Invalid regExp for customManagers: `***$}{]][`',
        },
        {
          message:
            'Regex Managers must contain currentValueTemplate configuration or regex group named currentValue',
        },
        {
          message:
            'Regex Managers must contain datasourceTemplate configuration or regex group named datasource',
        },
        {
          message:
            'Regex Managers must contain depName or packageName regex groups or templates',
        },
      ]);
    });

    it('passes if customManager fields are present', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['Dockerfile'],
            matchStrings: ['ENV (?<currentValue>.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            registryUrlTemplate: 'foobar',
            extractVersionTemplate: '^(?<version>v\\d+\\.\\d+)',
            depTypeTemplate: 'apple',
          },
          {
            customType: 'jsonata',
            fileFormat: 'json',
            managerFilePatterns: ['package.json'],
            matchStrings: [
              'packages.{"depName": depName, "currentValue": version, "datasource": "npm"}',
            ],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors if extra customManager fields are present', async () => {
      const config = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['Dockerfile'],
            matchStrings: ['ENV (?<currentValue>.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
            depTypeTemplate: 'apple',
            automerge: true,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config as any,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: 'Custom Manager contains disallowed fields: automerge',
        },
      ]);
    });

    it('errors if customManager fields are missing', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['Dockerfile'],
            matchStrings: ['ENV (.*?)\\s'],
            depNameTemplate: 'foo',
            datasourceTemplate: 'bar',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Regex Managers must contain currentValueTemplate configuration or regex group named currentValue',
        },
      ]);
    });

    it('errors if customManager fields are missing: JSONataManager', async () => {
      const config: RenovateConfig = {
        customManagers: [
          {
            customType: 'jsonata',
            fileFormat: 'json',
            managerFilePatterns: ['package.json'],
            matchStrings: ['packages'],
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          topic: 'Configuration Error',
          message: `JSONata Managers must contain currentValueTemplate configuration or currentValue in the query `,
        },
        {
          topic: 'Configuration Error',
          message: `JSONata Managers must contain datasourceTemplate configuration or datasource in the query `,
        },
        {
          topic: 'Configuration Error',
          message: `JSONata Managers must contain depName or packageName in the query or their templates`,
        },
      ]);
    });

    it('ignore keys', async () => {
      const config = {
        $schema: 'renovate.json',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates timezone preset', async () => {
      const config = {
        extends: [':timezone', ':timezone(Europe/Berlin)'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    describe('constraints', () => {
      it('can contain a valid tool name for Containerbase', async () => {
        const config: RenovateConfig = {
          constraints: {
            golang: '1.26.0',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('can contain a constraint for a non-Containerbase tool', async () => {
        const config: RenovateConfig = {
          constraints: {
            gomodMod: 'latest',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('warns if an unsupported constraint is specified', async () => {
        const config = {
          constraints: {
            'not-supported': '4.5.6',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          // @ts-expect-error: contains invalid values
          config,
          true,
        );
        expect(warnings).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraints.not-supported`: `not-supported` is not a supported constraint name',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('warns if a constraint is not valid', async () => {
        const config: RenovateConfig = {
          constraints: {
            node: '1.2.3foo',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraints.node=1.2.3foo` is not a valid tool version constraint, according to `node` versioning',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('errors if constraints is a malformed object', async () => {
        const config = {
          constraints: { packageRules: [{}] },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          // @ts-expect-error: contains invalid values
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraints.packageRules` should be an object of key-value pairs of constraints and their value',
          },
        ]);
      });

      it('errors if constraints is a malformed array', async () => {
        const config = {
          constraints: [1, 2, 3],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          // @ts-expect-error: contains invalid values
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraints` should be a json object',
          },
        ]);
      });
    });

    describe('constraintsVersioning', () => {
      it('cannot contain a valid tool name for Containerbase', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            // @ts-expect-error: not an AdditionalConstraintName
            golang: 'semver',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraintsVersioning.golang` is not a valid additional constraint name, as `golang` is a tool name, and `constraintsVersioning` can only override the versioning for a non-tool constraint',
          },
        ]);
      });

      it('can contain a constraint for a non-Containerbase tool', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            gomodMod: 'semver',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('cannot contain an additional constraint name with an invalid versioning scheme', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            gomodMod: 'not-supported-versioning',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraintsVersioning.gomodMod=not-supported-versioning`: `not-supported-versioning` is not a valid versioning scheme',
          },
        ]);
      });

      it('can contain an additional constraint name with a regex versioning scheme', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            gomodMod:
              'regex:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('cannot contain an unsupported constraint', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            // @ts-expect-error: contains invalid values
            'not-supported': '4.5.6',
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraintsVersioning.not-supported`: `not-supported` is not a known additional constraint name',
          },
        ]);
      });

      it('errors if constraintsVersioning is a malformed object', async () => {
        const config: RenovateConfig = {
          constraintsVersioning: {
            // @ts-expect-error: contains invalid values
            packageRules: [{}],
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraintsVersioning.packageRules` should be an object of key-value pairs of additional constraint names and their versioning',
          },
        ]);
      });

      it('errors if constraintsVersioning is a malformed array', async () => {
        const config: RenovateConfig = {
          // @ts-expect-error: contains invalid values
          constraintsVersioning: [1, 2, 3],
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'repo',
          config,
          true,
        );
        expect(warnings).toBeEmptyArray();
        expect(errors).toEqual([
          {
            topic: 'Configuration Error',
            message:
              'Configuration option `constraintsVersioning` should be a json object',
          },
        ]);
      });
    });

    it('validates object with ignored children', async () => {
      const config = {
        prBodyDefinitions: {},
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
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
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors if registryAliases depth is more than 1', async () => {
      const config = {
        registryAliases: {
          sample: {
            example1: 'http://www.example.com',
          } as unknown as string, // intentional incorrect config to check error message
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
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
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Invalid `registryAliases.registryAliases.example1` configuration: value is not a string',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if managerFilePatterns has wrong parent', async () => {
      const config: RenovateConfig = {
        managerFilePatterns: ['foo'],
        // @ts-expect-error: -- TODO: managers, datasources and versionings are not defined on RenovateConfig
        npm: {
          managerFilePatterns: ['package\\.json'],
          minor: {
            managerFilePatterns: ['bar'],
          },
        },
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['build.gradle'],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );

      expect(errors).toBeEmptyArray();
      expect(warnings).toEqual([
        {
          topic: 'managerFilePatterns',
          message: expect.toStartWith(
            `"managerFilePatterns" can't be used in ".". Allowed objects: `,
          ),
        },
        {
          topic: 'npm.minor.managerFilePatterns',
          message: expect.toStartWith(
            `"managerFilePatterns" can't be used in "minor". Allowed objects: `,
          ),
        },
      ]);
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
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'The "gradle" object can only be configured at the top level of a config but was found inside "maven"',
        },
      ]);
    });

    it('warns if hostType has the wrong parent', async () => {
      const config = {
        hostType: 'npm',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          topic: 'hostType',
          message:
            '"hostType" can\'t be used in ".". Allowed objects: hostRules.',
        },
      ]);
    });

    it('validates preset values', async () => {
      const config = {
        extends: ['foo', 'bar', 42] as never,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: 'extends: preset value is not a string',
        },
      ]);
    });

    it('errors on invalid preset syntax', async () => {
      const config = {
        extends: [
          'github>owner/repo//path@commitHash',
          'github>owner/repo//path#commitHash',
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: expect.stringContaining(
            'github>owner/repo//path@commitHash',
          ),
        },
      ]);
    });

    it('skips preset syntax validation for templates', async () => {
      const config = {
        extends: ['local>{{ env.PRESET_REPO }}:python-312'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('warns if only selectors in packageRules', async () => {
      const config = {
        packageRules: [{ matchDepTypes: ['foo'], matchPackageNames: ['bar'] }],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          message:
            'packageRules[0]: Each packageRule must contain at least one non-match* or non-exclude* field. Rule: {"matchDepTypes":["foo"],"matchPackageNames":["bar"]}',
        },
      ]);
    });

    it('errors if invalid combinations in packageRules', async () => {
      const config = partial<AllConfig>({
        packageRules: [
          {
            matchUpdateTypes: ['major'],
            registryUrls: ['https://registry.npmjs.org'],
          },
        ],
      });
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'packageRules[0]: packageRules cannot combine both matchUpdateTypes and registryUrls. Rule: {"matchUpdateTypes":["major"],"registryUrls":["https://registry.npmjs.org"]}',
        },
      ]);
    });

    it('warns when registryUrls is set at the top level of repo config', async () => {
      const config = {
        registryUrls: ['https://registry.npmjs.org'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          message: expect.stringContaining(
            'Setting `registryUrls` at the top level of your config will apply it to all managers',
          ),
        },
      ]);
    });

    it('warns when defaultRegistryUrls is set at the top level of repo config', async () => {
      const config = {
        defaultRegistryUrls: ['https://registry.npmjs.org'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          message: expect.stringContaining(
            'Setting `defaultRegistryUrls` at the top level of your config will apply it to all managers',
          ),
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
        'repo',
        config,
        true,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          topic: 'Configuration Warning',
          message:
            'packageRules[0].extends: you should not extend "group:" presets',
        },
      ]);
    });

    it('does not error on use of `global:` presets in `globalExtends`', async () => {
      const config = {
        globalExtends: ['global:safeEnv'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
        true,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });

    it('does not error on use of `global:` presets in global `extends`', async () => {
      const config = {
        extends: ['global:safeEnv'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
        true,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });

    it('errors on use of `global:` presets in inherit `extends`', async () => {
      const config = {
        extends: ['global:safeEnv'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'inherit',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'extends: you cannot extend from "global:" presets in a repository config\'s "extends"',
        },
      ]);
    });

    it('errors on use of `global:` presets in repo `extends`', async () => {
      const config = {
        extends: ['global:safeEnv'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
        true,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'extends: you cannot extend from "global:" presets in a repository config\'s "extends"',
        },
      ]);
    });

    // adding this test explicitly because we used to validate the customEnvVariables inside repo config previously
    it('warns if customEnvVariables are found in repo config', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: '123',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toMatchObject([
        {
          topic: 'Configuration Error',
          message: `The "customEnvVariables" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('errors if schedule is cron and has no * minutes', async () => {
      const config = {
        schedule: ['30 5 * * *'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Invalid schedule: `Invalid schedule: "30 5 * * *" has cron syntax, but doesn\'t have * as minutes`',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if invalid matchHost values in hostRules', async () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });

      const config = {
        hostRules: [
          {
            matchHost: '://',
            token: 'token',
          },
          {
            matchHost: '',
            token: 'token',
          },
          {
            matchHost: undefined,
            token: 'token',
          },
          {
            hostType: 'github',
            token: 'token',
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          topic: 'Configuration Error',
          message:
            'Configuration option `hostRules[2].matchHost` should be a string',
        },
        {
          topic: 'Configuration Error',
          message:
            'Invalid value for hostRules matchHost. It cannot be an empty string.',
        },
        {
          topic: 'Configuration Error',
          message: 'hostRules matchHost `://` is not a valid URL.',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('errors if forbidden header in hostRules', async () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });

      const config = {
        hostRules: [
          {
            matchHost: 'https://domain.com/all-versions',
            headers: {
              'X-Auth-Token': 'token',
              unallowedHeader: 'token',
            },
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            "hostRules header `unallowedHeader` is not allowed by this bot's `allowedHeaders`.",
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if headers values are not string', async () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });

      const config = {
        hostRules: [
          {
            matchHost: 'https://domain.com/all-versions',
            headers: {
              'X-Auth-Token': 10,
            } as unknown as Record<string, string>,
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            'Invalid hostRules headers value configuration: header must be a string.',
          topic: 'Configuration Error',
        },
      ]);
    });

    it('errors if allowedHeaders is empty', async () => {
      GlobalConfig.set({ allowedHeaders: [] });

      const config = {
        hostRules: [
          {
            matchHost: 'https://domain.com/all-versions',
            headers: {
              'X-Auth-Token': 'token',
            },
          },
        ],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message:
            "hostRules header `X-Auth-Token` is not allowed by this bot's `allowedHeaders`.",
          topic: 'Configuration Error',
        },
      ]);
    });

    it('catches invalid variable name in env config option', async () => {
      GlobalConfig.set({ allowedEnv: ['SOME*'] });
      const config = {
        env: {
          randomKey: '',
          SOME_VAR: 'some_value',
          SOME_OTHER_VAR: 10,
        },
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error: testing invalid values in env object
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            "Env variable name `randomKey` is not allowed by this bot's `allowedEnv`.",
        },
        {
          message:
            'Invalid env variable value: `env.SOME_OTHER_VAR` must be a string.',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches env config option if configured inside a parent', async () => {
      GlobalConfig.set({ allowedEnv: ['SOME*'] });
      const config = {
        npm: {
          env: {
            SOME_VAR: 'some_value',
          },
        },
        packageRules: [
          {
            matchManagers: ['regex'],
            env: {
              SOME_VAR: 'some_value',
            },
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'The "env" object can only be configured at the top level of a config but was found inside "npm"',
          topic: 'Configuration Error',
        },
        {
          message:
            'The "env" object can only be configured at the top level of a config but was found inside "packageRules[0]"',
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches when * or ** is combined with others patterns in a regexOrGlob option', async () => {
      const config = {
        packageRules: [
          {
            matchRepositories: ['groupA/**', 'groupB/**'], // valid
            enabled: false,
          },
          {
            matchRepositories: ['*', 'repo'], // invalid
            enabled: true,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'packageRules[1].matchRepositories: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.',
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('catches when negative number is used for integer type', async () => {
      const config = {
        azureWorkItemId: -2,
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            'Configuration option `azureWorkItemId` should be a positive integer. Found negative value instead.',
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates prPriority', async () => {
      const config = {
        packageRules: [
          {
            matchDepNames: ['somedep'],
            prPriority: -2,
          },
          {
            matchDepNames: ['some-other-dep'],
            prPriority: 2,
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'repo',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toBeEmptyArray();
    });
  });

  describe('validateConfig() -> globaOnly options', () => {
    it('returns errors for invalid options', async () => {
      const config = {
        logFile: 'something',
        logFileLevel: 'DEBUG',
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(errors).toMatchObject([
        {
          message: 'Invalid configuration option: logFile',
          topic: 'Configuration Error',
        },
        {
          message: 'Invalid configuration option: logFileLevel',
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates hostRules.headers', async () => {
      const config = {
        hostRules: [
          {
            matchHost: 'https://domain.com/all-versions',
            headers: {
              'X-Auth-Token': 'token',
            },
          },
        ],
        allowedHeaders: ['X-Auth-Token'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors if hostRules.headers is defined but allowedHeaders is not', async () => {
      const config = {
        hostRules: [
          {
            matchHost: 'https://domain.com/all-versions',
            headers: {
              'X-Auth-Token': 'token',
            },
          },
        ],
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            "hostRules header `X-Auth-Token` is not allowed by this bot's `allowedHeaders`.",
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates env', async () => {
      const config = {
        env: {
          SOME_VAR: 'SOME_VALUE',
        },
        allowedEnv: ['SOME*'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('handles prefixed onboardingConfigFileName', async () => {
      const config = {
        platform: 'forgejo',
        onboardingConfigFileName: '.forgejo/renovate.json',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: not sure why
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('allows unique onboardingConfigFileName if it is set in configFileNames', async () => {
      const config = {
        onboardingConfigFileName: '.forgejo/renovate.json',
        configFileNames: ['.forgejo/renovate.json'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('errors if env object is defined but allowedEnv is empty or undefined', async () => {
      const config = {
        env: {
          SOME_VAR: 'SOME_VALUE',
        },
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(errors).toMatchObject([
        {
          message:
            "Env variable name `SOME_VAR` is not allowed by this bot's `allowedEnv`.",
          topic: 'Configuration Error',
        },
      ]);
      expect(warnings).toBeEmptyArray();
    });

    it('validates env against the allowedEnv regex', async () => {
      const config = {
        env: {
          SOME_VAR: 'SOME_VALUE',
        },
        allowedEnv: ['/^SOME.*/'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates options with different type but defaultValue=null', async () => {
      const config = {
        minimumReleaseAge: null,
        groupName: null,
        groupSlug: null,
        dependencyDashboardLabels: null,
        defaultRegistryUrls: null,
        registryUrls: null,
        hostRules: [
          {
            artifactAuth: null,
            concurrentRequestLimit: null,
            httpsCertificate: null,
            httpsPrivateKey: null,
            httpsCertificateAuthority: null,
          },
        ],
        encrypted: null,
        milestone: null,
        branchConcurrentLimit: null,
        hashedBranchLength: null,
        assigneesSampleSize: null,
        reviewersSampleSize: null,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'repo',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });
  });

  describe('validate globalOptions()', () => {
    // TODO #40742 #40747
    it('binarySource=docker is deprecated', async () => {
      const config: GlobalConfig = {
        binarySource: 'docker',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toEqual([
        {
          topic: 'Deprecation Warning',
          message:
            'Usage of `binarySource=docker` is deprecated, and will be removed in the future. Please migrate to `binarySource=install`. Feedback on the usage of `binarySource=docker` is welcome at https://github.com/renovatebot/renovate/discussions/40742',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('binarySource', async () => {
      const config = {
        binarySource: 'invalid' as never,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toEqual([
        {
          message:
            'Invalid value `invalid` for `binarySource`. The allowed values are docker, global, install, hermit.',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    describe('validates string type options', () => {
      it('binarySource', async () => {
        const config = {
          binarySource: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message:
              'Invalid value `invalid` for `binarySource`. The allowed values are docker, global, install, hermit.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('baseDir', async () => {
        const config = {
          baseDir: false as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message: 'Configuration option `baseDir` should be a string.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('requireConfig', async () => {
        const config = {
          requireConfig: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message:
              'Invalid value `invalid` for `requireConfig`. The allowed values are required, optional, ignored.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('dryRun', async () => {
        const config = {
          dryRun: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message:
              'Invalid value `invalid` for `dryRun`. The allowed values are extract, lookup, full.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('repositoryCache', async () => {
        const config = {
          repositoryCache: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message:
              'Invalid value `invalid` for `repositoryCache`. The allowed values are enabled, disabled, reset.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('onboardingConfigFileName', async () => {
        const config = {
          onboardingConfigFileName: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message: `Invalid value \`invalid\` for \`onboardingConfigFileName\`. The allowed values are ${getConfigFileNames().join(', ')}.`,
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('onboardingConfig', async () => {
        const config = {
          onboardingConfig: {
            extends: ['config:recommended'],
            binarySource: 'global', // should not allow globalOnly options inside onboardingConfig
            managerFilePatterns: ['somefile'], // invalid at top level
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            topic: 'Configuration Error',
            message: `The "binarySource" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
          },
          {
            topic: 'managerFilePatterns',
            message: expect.toStartWith(
              `"managerFilePatterns" can't be used in ".". Allowed objects: `,
            ),
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('force', async () => {
        const config = {
          force: {
            extends: ['config:recommended'],
            binarySource: 'global',
            managerFilePatterns: ['somefile'], // invalid at top level
            constraints: {
              python: '2.7',
            },
          },
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            topic: 'managerFilePatterns',
            message: expect.toStartWith(
              `"managerFilePatterns" can't be used in ".". Allowed objects: `,
            ),
          },
        ]);
        expect(errors).toBeEmptyArray();
      });

      it('gitUrl', async () => {
        const config = {
          gitUrl: 'invalid' as never,
        };
        const { warnings, errors } = await configValidation.validateConfig(
          'global',
          config,
        );
        expect(warnings).toEqual([
          {
            message:
              'Invalid value `invalid` for `gitUrl`. The allowed values are default, ssh, endpoint.',
            topic: 'Configuration Error',
          },
        ]);
        expect(errors).toBeEmptyArray();
      });
    });

    it('validates boolean type options', async () => {
      const config = {
        unicodeEmoji: false,
        detectGlobalManagerConfig: 'invalid-type',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toMatchObject([
        {
          message: `Configuration option \`detectGlobalManagerConfig\` should be a boolean. Found: ${JSON.stringify(
            'invalid-type',
          )} (string).`,
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('validates integer type options', async () => {
      const config = {
        prCommitsPerRunLimit: 2,
        gitTimeout: 'invalid-type',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toMatchObject([
        {
          message: `Configuration option \`gitTimeout\` should be an integer. Found: ${JSON.stringify(
            'invalid-type',
          )} (string).`,
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('validates array type options', async () => {
      const config = {
        allowedCommands: ['cmd'],
        checkedBranches: 'invalid-type',
        gitNoVerify: ['invalid'],
        mergeConfidenceDatasources: [1],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toMatchObject([
        {
          message:
            'Configuration option `checkedBranches` should be a list (Array).',
          topic: 'Configuration Error',
        },
        {
          topic: 'Configuration Error',
          message:
            'Invalid value `1` for `mergeConfidenceDatasources`. The allowed values are go, maven, npm, nuget, packagist, pypi, rubygems.',
        },
        {
          message:
            'Invalid value for `gitNoVerify`. The allowed values are commit, push.',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('validates object type options', async () => {
      const config = {
        productLinks: {
          documentation: 'https://docs.renovatebot.com/',
          help: 'https://github.com/renovatebot/renovate/discussions',
          homepage: 'https://github.com/renovatebot/renovate',
        },
        secrets: 'invalid-type',
        cacheTtlOverride: {
          someField: false,
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toMatchObject([
        {
          topic: 'Configuration Error',
          message:
            'Configuration option `cacheTtlOverride.someField` should be an integer. Found: false (boolean).',
        },
        {
          message: 'Configuration option `secrets` should be a JSON object.',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toMatchObject([
        {
          message: 'cacheTtlOverride: namespace `someField` does not exist',
        },
      ]);
    });

    it('warns if negative number is used for integer type', async () => {
      const config = {
        prCommitsPerRunLimit: -2,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toMatchObject([
        {
          message:
            'Configuration option `prCommitsPerRunLimit` should be a positive integer. Found negative value instead.',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('warns on invalid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 123,
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error -- testing
        config,
      );
      expect(warnings).toMatchObject([
        {
          message:
            'Invalid `customEnvVariables.example2` configuration: value must be a string.',
          topic: 'Configuration Error',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('validates valid customEnvVariables objects', async () => {
      const config = {
        customEnvVariables: {
          example1: 'abc',
          example2: 'https://www.example2.com/example',
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('validates options with different type but defaultValue=null', async () => {
      const config = {
        onboardingCommitMessage: null,
        dryRun: null,
        logContext: null,
        endpoint: null,
        skipInstalls: null,
        autodiscoverFilter: null,
        autodiscoverNamespaces: null,
        autodiscoverTopics: null,
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: contains invalid values
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('fails for missing reportPath if reportType is "s3"', async () => {
      const config: RenovateConfig = {
        reportType: 's3',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: "reportType 's3' requires a configured reportPath",
        },
      ]);
    });

    it('validates reportPath if reportType is "s3"', async () => {
      const config: RenovateConfig = {
        reportType: 's3',
        reportPath: 's3://bucket-name/key-name',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('fails for missing reportPath if reportType is "file"', async () => {
      const config: RenovateConfig = {
        reportType: 'file',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toMatchObject([
        {
          message: "reportType 'file' requires a configured reportPath",
        },
      ]);
    });

    it('validates reportPath if reportType is "file"', async () => {
      const config: RenovateConfig = {
        reportType: 'file',
        reportPath: './report.json',
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('warns when registryUrls is set at the top level of global config', async () => {
      const config = {
        registryUrls: ['https://registry.npmjs.org'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          message: expect.stringContaining(
            'Setting `registryUrls` at the top level of your config will apply it to all managers',
          ),
        },
      ]);
    });

    it('warns when defaultRegistryUrls is set at the top level of global config', async () => {
      const config = {
        defaultRegistryUrls: ['https://registry.npmjs.org'],
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(errors).toBeEmptyArray();
      expect(warnings).toMatchObject([
        {
          message: expect.stringContaining(
            'Setting `defaultRegistryUrls` at the top level of your config will apply it to all managers',
          ),
        },
      ]);
    });

    it('validates postUpgradeTasks.installTools tool names', async () => {
      const config = {
        postUpgradeTasks: {
          executionMode: 'update' as const,
          installTools: {
            npm: {},
            node: {},
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toBeEmptyArray();
      expect(errors).toBeEmptyArray();
    });

    it('rejects invalid postUpgradeTasks.installTools tool names', async () => {
      const config = {
        postUpgradeTasks: {
          installTools: {
            npm: {},
            unknownTool: {},
          },
        },
      };
      const { warnings, errors } = await configValidation.validateConfig(
        'global',
        // @ts-expect-error: installTools.unknownTool is not a valid tool
        config,
      );
      expect(warnings).toMatchObject([
        {
          topic: 'Configuration Error',
          message:
            'Invalid `postUpgradeTasks.installTools.unknownTool` configuration: not a valid tool name.',
        },
      ]);
      expect(errors).toBeEmptyArray();
    });

    it('catches when * or ** is combined with others patterns in a regexOrGlob option', async () => {
      const config = {
        packageRules: [
          {
            matchRepositories: ['*', 'repo'], // invalid
            enabled: false,
          },
        ],
        allowedHeaders: ['*', '**'], // invalid
        autodiscoverProjects: ['**', 'project'], // invalid
        allowedEnv: ['env_var'], // valid
      };
      const { errors, warnings } = await configValidation.validateConfig(
        'global',
        config,
      );
      expect(warnings).toMatchObject([
        {
          message:
            'allowedHeaders: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.',
          topic: 'Configuration Error',
        },
        {
          message:
            'autodiscoverProjects: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.',
          topic: 'Configuration Error',
        },
      ]);

      expect(errors).toMatchObject([
        {
          message:
            'packageRules[0].matchRepositories: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.',
          topic: 'Configuration Error',
        },
      ]);
    });

    describe('cacheTtlOverride', () => {
      it('errors when using an invalid cache namespace', async () => {
        const config: AllConfig = {
          cacheTtlOverride: {
            // removed in 40.9.0
            'datasource-maven:metadata-xml': 123,
          },
        };

        const { errors, warnings } = await configValidation.validateConfig(
          'global',
          config,
        );

        expect(warnings).toBeEmptyArray();
        expect(errors).toMatchObject([
          {
            message:
              'cacheTtlOverride: namespace `datasource-maven:metadata-xml` does not exist',
            topic: 'Configuration Error',
          },
        ]);
      });

      it('allows a valid cache namespace', async () => {
        const config: AllConfig = {
          cacheTtlOverride: {
            'datasource-docker-hub-tags': 90,
          },
        };

        const { errors, warnings } = await configValidation.validateConfig(
          'global',
          config,
        );

        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });

      it('allows wildcards', async () => {
        const config: AllConfig = {
          cacheTtlOverride: {
            'datasource-rubygems': 120,
            'datasource-*': 60,
            'datasource-{crate,go}': 90,
            '/^changelog-/': 45,
            '*': 30,
          },
        };

        const { errors, warnings } = await configValidation.validateConfig(
          'global',
          config,
        );

        expect(warnings).toBeEmptyArray();
        expect(errors).toBeEmptyArray();
      });
    });

    describe('repositories', () => {
      it('is validated', async () => {
        const config: AllConfig = {
          repositories: [
            {
              repository: 'valid/name',
              // @ts-expect-error -- invalid config
              dependencyDashboardHeader: true,
            },
          ],
        };

        const { errors, warnings } = await configValidation.validateConfig(
          'global',
          config,
        );

        expect(warnings).toBeEmptyArray();
        expect(errors).toMatchObject([
          {
            message:
              'Configuration option `repositories[0].dependencyDashboardHeader` should be a string',
          },
        ]);
      });
    });
  });
});
