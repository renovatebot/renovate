import is from '@sindresorhus/is';
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
type RenameMapKey = keyof typeof renameMap;

function renameKeys(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = {};
  for (const [key, val] of Object.entries(packageRule)) {
    newPackageRule[renameMap[key as RenameMapKey] ?? key] = val;
  }
  return newPackageRule;
}

function removeMatchLanguage(packageRule: PackageRule): PackageRule[] {
  const newPackageRules: PackageRule[] = [];
  const matchLanguages = packageRule.matchLanguages;
  // no migration needed
  if (
    is.nullOrUndefined(matchLanguages) ||
    !is.array<string>(matchLanguages) ||
    matchLanguages.length === 0
  ) {
    return [packageRule];
  }

  // deep copy
  const newRule: PackageRule = structuredClone(packageRule);
  delete newRule.matchLanguages;

  // are there any 1:1 migrateable languages
  newRule.matchCategories = matchLanguages;
  newPackageRules.push(newRule);

  return newPackageRules;
}

export class PackageRulesMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  override run(value: unknown): void {
    let packageRules = (this.get('packageRules') as PackageRule[]) ?? [];
    packageRules = Array.isArray(packageRules) ? [...packageRules] : [];

    packageRules = packageRules.map(renameKeys);

    packageRules = packageRules.flatMap(removeMatchLanguage);

    this.rewrite(packageRules);
  }
}
