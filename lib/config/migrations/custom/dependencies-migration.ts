import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class DependenciesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'dependencies';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      const packageRules: PackageRule[] = this.get('packageRules') ?? [];

      packageRules.push({
        matchDepTypes: ['dependencies'],
        ...value,
      } as PackageRule);

      if (packageRules.length) {
        this.setHard('packageRules', packageRules);
      }
    }
  }
}
