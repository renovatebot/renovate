import { isArray } from '@sindresorhus/is';
import type { PackageRule } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class PathRulesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'pathRules';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    if (isArray<PackageRule>(value)) {
      this.setHard(
        'packageRules',
        isArray(packageRules) ? packageRules.concat(value) : value,
      );
    }
  }
}
