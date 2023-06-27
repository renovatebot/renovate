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
          packagePatterns: [],
          sourceUrlPrefixes: [],
          updateTypes: [],
        },
      ],
    };
    const migratedPackageRules =
      MigrationsService.run(originalConfig).packageRules;

    const mappedProperties = Object.keys(migratedPackageRules![0]);
    const expectedMappedProperties = Object.keys(
      originalConfig.packageRules![0]
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
      }
    );
  });
});
