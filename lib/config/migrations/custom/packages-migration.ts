import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PackagesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packages';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    const newPackageRules = Array.isArray(packageRules) ? packageRules : [];
    if (is.plainObject(packageRules)) {
      newPackageRules.push(packageRules);
    }
    this.setHard('packageRules', newPackageRules.concat(value));
  }
}
