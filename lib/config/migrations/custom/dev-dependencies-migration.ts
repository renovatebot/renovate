import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class DevDependenciesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'devDependencies';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      const packageRules: PackageRule[] = this.get('packageRules') ?? [];

      packageRules.push({
        matchDepTypes: ['devDependencies'],
        ...value,
      } as PackageRule);

      if (packageRules.length) {
        this.setHard('packageRules', packageRules);
      }
    }
  }
}
