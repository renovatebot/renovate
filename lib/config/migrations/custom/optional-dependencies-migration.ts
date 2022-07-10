import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class OptionalDependenciesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'optionalDependencies';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      const packageRules: PackageRule[] = this.get('packageRules') ?? [];

      packageRules.push({
        matchDepTypes: ['optionalDependencies'],
        ...value,
      } as PackageRule);

      if (packageRules.length) {
        this.setHard('packageRules', packageRules);
      }
    }
  }
}
