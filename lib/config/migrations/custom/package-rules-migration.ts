import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export const renameMap = {
  paths: 'matchPaths',
  languages: 'matchLanguages',
  baseBranchList: 'matchBaseBranches',
  managers: 'matchManagers',
  datasources: 'matchDatasources',
  depTypeList: 'matchDepTypes',
  packageNames: 'matchPackageNames',
  packagePatterns: 'matchPackagePatterns',
  sourceUrlPrefixes: 'matchSourceUrlPrefixes',
  updateTypes: 'matchUpdateTypes',
};

export class PackageRulesMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  override run(value: PackageRule[] | null): void {
    let packageRules = this.get('packageRules') as PackageRule[];
    packageRules = Array.isArray(packageRules) ? [...packageRules] : [];

    packageRules = packageRules.map((packageRule) => {
      const newPackageRule: PackageRule = {};

      for (const [key, value] of Object.entries(packageRule)) {
        newPackageRule[renameMap[key as keyof typeof renameMap] ?? key] = value;
      }

      return newPackageRule;
    });

    this.rewrite(packageRules);
  }
}
