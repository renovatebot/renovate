import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export const renameMap = {
  matchFiles: 'matchFileNames',
  matchPaths: 'matchFileNames',
  paths: 'matchFileNames',
  languages: 'matchCategories',
  matchLanguages: 'matchCategories',
  baseBranchList: 'matchBaseBranches',
  managers: 'matchManagers',
  datasources: 'matchDatasources',
  depTypeList: 'matchDepTypes',
  packageNames: 'matchPackageNames',
  packagePatterns: 'matchPackagePatterns',
  sourceUrlPrefixes: 'matchSourceUrlPrefixes',
  updateTypes: 'matchUpdateTypes',
};
type RenameMapKey = keyof typeof renameMap;

function renameKeys(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = {};
  for (const [key, val] of Object.entries(packageRule)) {
    newPackageRule[renameMap[key as RenameMapKey] ?? key] = val;
  }
  return newPackageRule;
}

export class PackageRulesMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  override run(value: unknown): void {
    let packageRules = (this.get('packageRules') as PackageRule[]) ?? [];
    packageRules = Array.isArray(packageRules) ? [...packageRules] : [];

    packageRules = packageRules.map(renameKeys);

    this.rewrite(packageRules);
  }
}
