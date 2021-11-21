import { AbstractMigration } from '../base/abstract-migration';

export class PathRulesMigration extends AbstractMigration {
  readonly propertyName = 'pathRules';

  override run(value): void {
    const packageRules = this.get('packageRules');

    this.delete(this.propertyName);

    if (Array.isArray(value)) {
      const newPackageRules = Array.isArray(packageRules)
        ? packageRules.concat(value)
        : value;

      this.setHard('packageRules', newPackageRules);
    }
  }
}
