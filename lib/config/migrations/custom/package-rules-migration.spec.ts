import type { RenovateConfig } from '../../types';
import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/package-rules-migration', () => {
  it('should migrate value to object', () => {
    const res = {
      packageRules: [
        {
          matchPaths: [],
          labels: ['linting'],
          matchBaseBranches: [],
          matchLanguages: [],
          matchManagers: [],
          matchDatasources: [],
          matchDepTypes: [],
          addLabels: [],
          matchPackageNames: [],
          matchPackagePatterns: [],
          matchSourceUrlPrefixes: [],
          matchUpdateTypes: [],
        },
      ],
    };
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
    const expectedMappedProperties = Object.keys(res.packageRules[0]);

    expect(expectedMappedProperties).toEqual(mappedProperties);
  });
});
