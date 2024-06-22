import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class PathRulesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'pathRules';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    if (is.array<PackageRule>(value)) {
      this.setHard(
        'packageRules',
        is.array(packageRules) ? packageRules.concat(value) : value,
      );
    }
  }
}
