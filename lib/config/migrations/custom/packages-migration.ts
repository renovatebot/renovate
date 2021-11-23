import { AbstractMigration } from '../base/abstract-migration';

export class PackagesMigration extends AbstractMigration {
  readonly propertyName = 'packages';

  override run(value): void {
    const packageRules = this.get('packageRules');

    this.delete();

    const newPackageRules = Array.isArray(packageRules)
      ? packageRules.concat(value)
      : value;
    this.setHard('packageRules', newPackageRules);
  }
}
