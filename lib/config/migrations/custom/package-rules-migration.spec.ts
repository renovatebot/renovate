import type { RenovateConfig } from '../../types';
import { MigrationsService } from '../migrations-service';
import { PackageRulesMigration, renameMap } from './package-rules-migration';

describe('config/migrations/custom/package-rules-migration', () => {
  it('should preserve config order', () => {
    const originalConfig: RenovateConfig = {
      packageRules: [
        {
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

  it('should not migrate nested packageRules', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate languages to categories', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate single match rule', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate excludePackageNames to matchPackageNames', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate matchPackagePatterns to matchPackageNames', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate all match/exclude when value is of type string', () => {
    expect(PackageRulesMigration).toMigrate(
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

  it('should migrate all match/exclude at once', () => {
    expect(PackageRulesMigration).toMigrate(
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
