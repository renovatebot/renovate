import type { RenovateConfig } from '../../types.ts';
import { MigrationsService } from '../migrations-service.ts';
import { PackageRulesMigration, renameMap } from './package-rules-migration.ts';

function configWithPackageRule(
  packageRule: Record<string, unknown>,
): Record<string, unknown> {
  return {
    packageRules: [{ ...packageRule, automerge: true }],
  };
}

describe('config/migrations/custom/package-rules-migration', () => {
  it('should preserve config order', () => {
    const originalConfig: RenovateConfig = {
      packageRules: [
        {
          // @ts-expect-error -- old type
          paths: [],
          labels: ['linting'],
          baseBranchList: [],
          languages: [],
          managers: [],
          datasources: [],
          depTypeList: [],
          addLabels: [],
          packageNames: [],
          updateTypes: [],
        },
      ],
    };
    const migratedPackageRules =
      MigrationsService.run(originalConfig).packageRules;

    const mappedProperties = Object.keys(migratedPackageRules![0]);
    const expectedMappedProperties = Object.keys(
      originalConfig.packageRules![0],
    ).map((key) => renameMap[key as keyof typeof renameMap] ?? key);

    expect(mappedProperties).toEqual(expectedMappedProperties);
  });

  it('should not migrate nested packageRules', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            paths: [],
            packgageRules: {
              languages: ['javascript'],
            },
          },
        ],
      },
      {
        packageRules: [
          {
            matchFileNames: [],
            packgageRules: {
              languages: ['javascript'],
            },
          },
        ],
      },
    );
  });

  it('should migrate languages to categories', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchLanguages: ['docker', 'js'],
            addLabels: ['docker'],
          },
          {
            languages: ['java'],
            addLabels: ['java'],
          },
        ],
      },
      {
        packageRules: [
          {
            matchCategories: ['docker', 'js'],
            addLabels: ['docker'],
          },
          {
            matchCategories: ['java'],
            addLabels: ['java'],
          },
        ],
      },
    );
  });

  it('should migrate single match rule', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchLanguages: ['python'],
            addLabels: ['py'],
          },
        ],
      },
      {
        packageRules: [
          {
            matchCategories: ['python'],
            addLabels: ['py'],
          },
        ],
      },
    );
  });

  it('should migrate excludePackageNames to matchPackageNames', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            excludePackageNames: ['foo', 'bar'],
            automerge: true,
          },
          {
            matchPackageNames: ['baz'],
            excludePackageNames: ['foo', 'bar'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            automerge: true,
            matchPackageNames: ['!foo', '!bar'],
          },
          {
            automerge: true,
            matchPackageNames: ['baz', '!foo', '!bar'],
          },
        ],
      },
    );
  });

  it('should migrate matchPackagePatterns to matchPackageNames', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchPackagePatterns: ['*'],
            automerge: true,
          },
          {
            matchPackagePatterns: ['foo', 'bar'],
            automerge: true,
          },
          {
            matchPackageNames: ['baz'],
            matchPackagePatterns: ['foo', 'bar'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            automerge: true,
            matchPackageNames: ['*'],
          },
          {
            automerge: true,
            matchPackageNames: ['/foo/', '/bar/'],
          },
          {
            automerge: true,
            matchPackageNames: ['baz', '/foo/', '/bar/'],
          },
        ],
      },
    );
  });

  describe('legacy pattern match-all conversion', () => {
    it.each`
      legacyField                 | migratedField          | legacyPattern | migratedMatcher
      ${'matchDepPatterns'}       | ${'matchDepNames'}     | ${'*'}        | ${'*'}
      ${'matchDepPatterns'}       | ${'matchDepNames'}     | ${'^*$'}      | ${'*'}
      ${'matchPackagePatterns'}   | ${'matchPackageNames'} | ${'^*$'}      | ${'*'}
      ${'excludeDepPatterns'}     | ${'matchDepNames'}     | ${'*'}        | ${'!**'}
      ${'excludeDepPatterns'}     | ${'matchDepNames'}     | ${'^*$'}      | ${'!**'}
      ${'excludePackagePatterns'} | ${'matchPackageNames'} | ${'*'}        | ${'!**'}
      ${'excludePackagePatterns'} | ${'matchPackageNames'} | ${'^*$'}      | ${'!**'}
    `(
      'migrates $legacyField pattern $legacyPattern to $migratedField matcher $migratedMatcher',
      async ({
        legacyField,
        migratedField,
        legacyPattern,
        migratedMatcher,
      }) => {
        await expect(PackageRulesMigration).toMigrate(
          configWithPackageRule({ [legacyField]: [legacyPattern] }),
          configWithPackageRule({ [migratedField]: [migratedMatcher] }),
        );
      },
    );

    it('preserves an ordinary raw regex that matches every dependency', async () => {
      await expect(PackageRulesMigration).toMigrate(
        configWithPackageRule({
          matchDepPatterns: ['some-dep'],
          excludeDepPatterns: ['.*'],
        }),
        configWithPackageRule({
          matchDepNames: ['/some-dep/', '!/.*/'],
        }),
      );
    });
  });

  describe('normalizing matcher combinations introduced by migration', () => {
    describe('direct matcher renames containing a match-all glob', () => {
      it.each`
        legacyField         | migratedField          | specificMatcher
        ${'matchFiles'}     | ${'matchFileNames'}    | ${'package.json'}
        ${'matchPaths'}     | ${'matchFileNames'}    | ${'src/**'}
        ${'paths'}          | ${'matchFileNames'}    | ${'src/**'}
        ${'languages'}      | ${'matchCategories'}   | ${'javascript'}
        ${'matchLanguages'} | ${'matchCategories'}   | ${'javascript'}
        ${'baseBranchList'} | ${'matchBaseBranches'} | ${'main'}
        ${'managers'}       | ${'matchManagers'}     | ${'npm'}
        ${'datasources'}    | ${'matchDatasources'}  | ${'npm'}
        ${'depTypeList'}    | ${'matchDepTypes'}     | ${'dependencies'}
        ${'packageNames'}   | ${'matchPackageNames'} | ${'some-package'}
        ${'updateTypes'}    | ${'matchUpdateTypes'}  | ${'minor'}
      `(
        'keeps only match-all when renaming $legacyField to $migratedField',
        async ({ legacyField, migratedField, specificMatcher }) => {
          await expect(PackageRulesMigration).toMigrate(
            configWithPackageRule({
              [legacyField]: ['*', specificMatcher],
            }),
            configWithPackageRule({ [migratedField]: ['*'] }),
          );
        },
      );

      it('recognizes "**" as match-all', async () => {
        await expect(PackageRulesMigration).toMigrate(
          configWithPackageRule({ managers: ['**', 'npm'] }),
          configWithPackageRule({ matchManagers: ['**'] }),
        );
      });
    });

    describe('positive legacy matchers merged with a modern match-all', () => {
      it.each`
        legacyField                 | migratedField          | legacyValue
        ${'matchDepPrefixes'}       | ${'matchDepNames'}     | ${'some-dep'}
        ${'matchDepPatterns'}       | ${'matchDepNames'}     | ${'some-dep'}
        ${'matchPackagePrefixes'}   | ${'matchPackageNames'} | ${'some-package'}
        ${'matchPackagePatterns'}   | ${'matchPackageNames'} | ${'some-package'}
        ${'packagePatterns'}        | ${'matchPackageNames'} | ${'some-package'}
        ${'matchSourceUrlPrefixes'} | ${'matchSourceUrls'}   | ${'https://github.com/example'}
        ${'sourceUrlPrefixes'}      | ${'matchSourceUrls'}   | ${'https://github.com/example'}
      `(
        'drops the redundant $legacyField matcher from $migratedField',
        async ({ legacyField, migratedField, legacyValue }) => {
          await expect(PackageRulesMigration).toMigrate(
            configWithPackageRule({
              [migratedField]: ['*'],
              [legacyField]: [legacyValue],
            }),
            configWithPackageRule({ [migratedField]: ['*'] }),
          );
        },
      );
    });

    describe('legacy exclusions merged with a modern match-all', () => {
      it.each`
        legacyField                 | migratedField          | legacyValue             | migratedMatcher
        ${'excludeDepNames'}        | ${'matchDepNames'}     | ${'some-dep'}           | ${'!some-dep'}
        ${'excludeDepPrefixes'}     | ${'matchDepNames'}     | ${'some-dep'}           | ${'!some-dep{/,}**'}
        ${'excludeDepPatterns'}     | ${'matchDepNames'}     | ${'some-dep'}           | ${'!/some-dep/'}
        ${'excludePackageNames'}    | ${'matchPackageNames'} | ${'some-package'}       | ${'!some-package'}
        ${'excludePackagePrefixes'} | ${'matchPackageNames'} | ${'some-package'}       | ${'!some-package{/,}**'}
        ${'excludePackagePatterns'} | ${'matchPackageNames'} | ${'some-package'}       | ${'!/some-package/'}
        ${'excludeRepositories'}    | ${'matchRepositories'} | ${'example/repository'} | ${'!example/repository'}
      `(
        'keeps the $legacyField exclusion in $migratedField',
        async ({
          legacyField,
          migratedField,
          legacyValue,
          migratedMatcher,
        }) => {
          await expect(PackageRulesMigration).toMigrate(
            configWithPackageRule({
              [migratedField]: ['*'],
              [legacyField]: [legacyValue],
            }),
            configWithPackageRule({ [migratedField]: [migratedMatcher] }),
          );
        },
      );

      it('recognizes "**" as match-all', async () => {
        await expect(PackageRulesMigration).toMigrate(
          configWithPackageRule({
            matchPackageNames: ['**'],
            excludePackageNames: ['some-package'],
          }),
          configWithPackageRule({ matchPackageNames: ['!some-package'] }),
        );
      });
    });

    describe('multiple legacy fields targeting the same modern matcher', () => {
      it('normalizes package matchers only after all legacy fields are merged', async () => {
        await expect(PackageRulesMigration).toMigrate(
          configWithPackageRule({
            matchPackageNames: ['*'],
            excludePackageNames: ['some-package'],
            packagePatterns: ['another-package'],
          }),
          configWithPackageRule({
            matchPackageNames: ['!some-package'],
          }),
        );
      });

      it('removes a dependency match-all combined with an exclusion', async () => {
        await expect(PackageRulesMigration).toMigrate(
          configWithPackageRule({
            matchDepPatterns: ['*'],
            excludeDepPatterns: ['some-dep'],
          }),
          configWithPackageRule({
            matchDepNames: ['!/some-dep/'],
          }),
        );
      });
    });
  });

  describe('migration scope and semantic preservation', () => {
    it('preserves a negative match-all combined with a positive dependency matcher', async () => {
      await expect(PackageRulesMigration).toMigrate(
        configWithPackageRule({
          matchDepPatterns: ['some-dep'],
          excludeDepPatterns: ['*'],
        }),
        configWithPackageRule({
          matchDepNames: ['/some-dep/', '!**'],
        }),
      );
    });

    it('leaves modern matcher fields unchanged without legacy fields', async () => {
      const modernPackageRule = {
        matchFileNames: ['*', 'package.json'],
        matchCategories: ['*', 'javascript'],
        matchBaseBranches: ['*', 'main'],
        matchPackageNames: ['*', '!some-package'],
        matchManagers: ['*', 'npm'],
        matchDatasources: ['*', 'npm'],
        matchDepTypes: ['*', 'dependencies'],
        matchUpdateTypes: ['*', 'minor'],
        matchDepNames: ['**', 'some-dep'],
        matchSourceUrls: ['**', 'https://github.com/example'],
        matchRepositories: ['**', 'example/repository'],
      };

      await expect(PackageRulesMigration).toMigrate(
        configWithPackageRule(modernPackageRule),
        configWithPackageRule(structuredClone(modernPackageRule)),
        false,
      );
    });

    it('migrates a standalone repository exclusion', async () => {
      await expect(PackageRulesMigration).toMigrate(
        configWithPackageRule({
          excludeRepositories: ['renovatebot/renovate'],
        }),
        configWithPackageRule({
          matchRepositories: ['!renovatebot/renovate'],
        }),
      );
    });
  });

  it('should migrate all match/exclude when value is of type string', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchPackagePatterns: 'pattern',
            matchPackagePrefixes: 'prefix1',
            matchSourceUrlPrefixes: 'prefix1',
            excludePackageNames: 'excluded',
            excludePackagePatterns: 'excludepattern',
            excludePackagePrefixes: 'prefix1b',
            matchDepPatterns: 'pattern',
            matchDepPrefixes: 'prefix1',
            excludeDepNames: 'excluded',
            excludeDepPatterns: 'excludepattern',
            excludeDepPrefixes: 'prefix1b',
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            matchPackageNames: [
              '/pattern/',
              'prefix1{/,}**',
              '!excluded',
              '!/excludepattern/',
              '!prefix1b{/,}**',
            ],
            matchDepNames: [
              '/pattern/',
              'prefix1{/,}**',
              '!excluded',
              '!/excludepattern/',
              '!prefix1b{/,}**',
            ],
            matchSourceUrls: ['prefix1{/,}**'],
            automerge: true,
          },
        ],
      },
    );
  });

  it('should migrate all match/exclude at once', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchPackagePatterns: ['pattern'],
            matchPackagePrefixes: ['prefix1', 'prefix2'],
            matchSourceUrlPrefixes: ['prefix1', 'prefix2'],
            excludePackageNames: ['excluded'],
            excludePackagePatterns: ['excludepattern'],
            excludePackagePrefixes: ['prefix1b'],
            matchPackageNames: ['mpn1', 'mpn2'],
            matchDepPatterns: ['pattern'],
            matchDepPrefixes: ['prefix1', 'prefix2'],
            excludeDepNames: ['excluded'],
            excludeDepPatterns: ['excludepattern'],
            excludeDepPrefixes: ['prefix1b'],
            matchDepNames: ['mpn1', 'mpn2'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            matchPackageNames: [
              'mpn1',
              'mpn2',
              '/pattern/',
              'prefix1{/,}**',
              'prefix2{/,}**',
              '!excluded',
              '!/excludepattern/',
              '!prefix1b{/,}**',
            ],
            matchDepNames: [
              'mpn1',
              'mpn2',
              '/pattern/',
              'prefix1{/,}**',
              'prefix2{/,}**',
              '!excluded',
              '!/excludepattern/',
              '!prefix1b{/,}**',
            ],
            matchSourceUrls: ['prefix1{/,}**', 'prefix2{/,}**'],
            automerge: true,
          },
        ],
      },
    );
  });
});
