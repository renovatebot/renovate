import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { PackageRule } from '../../types';
import { mergeChildConfig } from '../../utils';
import { AbstractMigration } from '../base/abstract-migration';

const renameMap = {
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

    if (is.plainObject(value)) {
      packageRules.push(value);
    }

    packageRules = packageRules.map((packageRule) => {
      const newPackageRule: PackageRule = {};

      for (const [key, value] of Object.entries(packageRule)) {
        newPackageRule[renameMap[key as keyof typeof renameMap] ?? key] = value;
      }

      return newPackageRule;
    });

    packageRules = packageRules.flatMap((packageRule) => {
      if (Array.isArray(packageRule.packageRules)) {
        const subrules: PackageRule[] = [];
        logger.debug('Flattening nested packageRules');

        for (const subrule of packageRule.packageRules) {
          const combinedRule = mergeChildConfig(packageRule, subrule);
          delete combinedRule.packageRules;
          subrules.push(combinedRule);
        }
        return subrules;
      }
      return packageRule;
    }) as PackageRule[];

    this.rewrite(packageRules);
  }
}
