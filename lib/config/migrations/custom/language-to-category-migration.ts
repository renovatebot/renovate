import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class LanguageToCategoryMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  dockerLanguageManagers = [
    'ansible',
    'dockerfile',
    'docker-compose',
    'droneci',
    'kubernetes',
    'woodpecker',
  ];

  override run(value: Record<string, unknown>[]): void {
    const newPackageRules: PackageRule[] = [];
    for (const packageRule of value) {
      const matchLanguages = packageRule['matchLanguages'];
      // no migration needed
      if (
        is.nullOrUndefined(matchLanguages) ||
        !is.array<string>(matchLanguages)
      ) {
        newPackageRules.push(packageRule);
        continue;
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
        continue;
      }
      const newMatchManagerRule: any = { ...packageRule };
      delete newMatchManagerRule.matchLanguages;

      newMatchManagerRule.matchManagers = this.dockerLanguageManagers;
      newPackageRules.push(newMatchManagerRule);
    }
    this.rewrite(newPackageRules);
  }
}
