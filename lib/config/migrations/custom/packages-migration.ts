import { isArray } from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class PackagesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packages';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    let newPackageRules = isArray(packageRules) ? packageRules : [];
    if (isArray<PackageRule>(value)) {
      newPackageRules = newPackageRules.concat(value);
    }
    this.setHard('packageRules', newPackageRules);
  }
}
