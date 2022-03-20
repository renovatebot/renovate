import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PackagesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packages';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    let newPackageRules = Array.isArray(packageRules) ? packageRules : [];
    if (is.plainObject(packageRules)) {
      newPackageRules.push(packageRules);
    }
    if (Array.isArray(value)) {
      newPackageRules = newPackageRules.concat(value);
    }
    this.setHard('packageRules', newPackageRules);
  }
}
