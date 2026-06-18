import type { RenovateConfig } from '../../types.ts';
import { MigrationsService } from '../migrations-service.ts';
import { PackageRulesMigration, renameMap } from './package-rules-migration.ts';

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

  it.each`
    pattern
    ${'*'}
    ${'**'}
    ${'!*'}
    ${'!**'}
  `(
    'should migrate packagePatterns $pattern with excludePackagePatterns to negative matchPackageNames',
    async ({ pattern }) => {
      await expect(PackageRulesMigration).toMigrate(
        {
          packageRules: [
            {
              packagePatterns: [pattern],
              excludePackagePatterns: ['some-package'],
              automerge: true,
            },
          ],
        },
        {
          packageRules: [
            {
              automerge: true,
              matchPackageNames: ['!/some-package/'],
            },
          ],
        },
      );
    },
  );

  it.each`
    pattern
    ${'*'}
    ${'**'}
    ${'!*'}
    ${'!**'}
  `(
    'should migrate excludePackagePatterns $pattern to a negative match-all matcher',
    async ({ pattern }) => {
      await expect(PackageRulesMigration).toMigrate(
        {
          packageRules: [
            {
              packagePatterns: ['some-package'],
              excludePackagePatterns: [pattern],
              automerge: true,
            },
          ],
        },
        {
          packageRules: [
            {
              automerge: true,
              matchPackageNames: ['!**'],
            },
          ],
        },
      );
    },
  );

  it('should normalize matchPackageNames containing match-all patterns', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchPackageNames: ['*', '!/some-package/'],
            automerge: true,
          },
          {
            matchPackageNames: ['**', 'some-package'],
            automerge: true,
          },
          {
            matchPackageNames: ['!*', 'some-package'],
            automerge: true,
          },
          {
            matchPackageNames: ['!**', 'some-package'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            matchPackageNames: ['!/some-package/'],
            automerge: true,
          },
          {
            matchPackageNames: ['**'],
            automerge: true,
          },
          {
            matchPackageNames: ['!*', 'some-package'],
            automerge: true,
          },
          {
            matchPackageNames: ['!**'],
            automerge: true,
          },
        ],
      },
    );
  });

  it('should normalize regex-or-glob package rule matchers containing match-all patterns', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchManagers: ['*', 'npm'],
            matchDatasources: ['*', '!docker'],
            matchRepositories: ['!**', 'renovatebot/renovate'],
            matchSourceUrls: ['**', '!https://github.com/renovatebot/renovate'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            matchManagers: ['*'],
            matchDatasources: ['!docker'],
            matchRepositories: ['!**'],
            matchSourceUrls: ['!https://github.com/renovatebot/renovate'],
            automerge: true,
          },
        ],
      },
    );
  });

  it('should migrate match-all dep patterns to matchDepNames', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            matchDepPatterns: ['*'],
            excludeDepPatterns: ['some-dep'],
            automerge: true,
          },
          {
            matchDepPatterns: ['some-dep'],
            excludeDepPatterns: ['**'],
            automerge: true,
          },
          {
            matchDepPatterns: ['some-dep'],
            excludeDepPatterns: ['!*'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            matchDepNames: ['!/some-dep/'],
            automerge: true,
          },
          {
            matchDepNames: ['!**'],
            automerge: true,
          },
          {
            matchDepNames: ['!**'],
            automerge: true,
          },
        ],
      },
    );
  });

  it('should migrate excludeRepositories to matchRepositories', async () => {
    await expect(PackageRulesMigration).toMigrate(
      {
        packageRules: [
          {
            excludeRepositories: ['renovatebot/renovate'],
            automerge: true,
          },
        ],
      },
      {
        packageRules: [
          {
            automerge: true,
            matchRepositories: ['!renovatebot/renovate'],
          },
        ],
      },
    );
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
