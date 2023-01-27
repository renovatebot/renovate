import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export const renameMap = {
  paths: 'matchPaths',
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

const dockerLanguageManagers = [
  'ansible',
  'dockerfile',
  'docker-compose',
  'droneci',
  'kubernetes',
  'woodpecker',
];

function removeMatchLanguage(packageRule: PackageRule): PackageRule[] {
  const newPackageRules: PackageRule[] = [];
  const matchLanguages = packageRule['matchLanguages'];
  // no migration needed
  if (is.nullOrUndefined(matchLanguages) || !is.array<string>(matchLanguages)) {
    return [packageRule];
  }

  // deep copy
  const newRule: any = { ...packageRule };
  delete newRule.matchLanguages;

  const filteredLanguages = matchLanguages.filter(
    (language) => language !== 'docker'
  );
  // are there any 1:1 migrateable languages
  if (filteredLanguages.length) {
    newRule.matchCategories = filteredLanguages;
    newPackageRules.push(newRule);
  }

  // if there has been no docker tag we need not create a separate rule to mimic OR behaviour
  if (filteredLanguages.length === matchLanguages.length) {
    return newPackageRules;
  }
  const newMatchManagerRule: any = { ...packageRule };
  delete newMatchManagerRule.matchLanguages;

  newMatchManagerRule.matchManagers = dockerLanguageManagers;
  newPackageRules.push(newMatchManagerRule);

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
