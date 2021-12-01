import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PackageRulesMigration extends AbstractMigration {
  readonly propertyName = 'packageRules';

  readonly renameMap: ReadonlyMap<string, string> = new Map([
    ['paths', 'matchPaths'],
    ['languages', 'matchLanguages'],
    ['baseBranchList', 'matchBaseBranches'],
    ['managers', 'matchManagers'],
    ['datasources', 'matchDatasources'],
    ['depTypeList', 'matchDepTypes'],
    ['packageNames', 'matchPackageNames'],
    ['packagePatterns', 'matchPackagePatterns'],
    ['sourceUrlPrefixes', 'matchSourceUrlPrefixes'],
    ['updateTypes', 'matchUpdateTypes'],
  ]);

  override run(value): void {
    let packageRules = this.get('packageRules');
    packageRules = Array.isArray(packageRules) ? [...packageRules] : [];

    if (is.plainObject(value)) {
      packageRules.push(value);
    }

    if (is.array(packageRules)) {
      packageRules = packageRules.map((packageRule) => {
        const newPackageRule = {};

        for (const [key, value] of Object.entries(packageRule)) {
          newPackageRule[this.renameMap.get(key) ?? key] = value;
        }

        return newPackageRule;
      });
    }

    this.rewrite(packageRules);
  }
}
