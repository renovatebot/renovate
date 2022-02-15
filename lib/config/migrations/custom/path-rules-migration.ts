import { AbstractMigration } from '../base/abstract-migration';

export class PathRulesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'pathRules';

  override run(value: unknown): void {
    const packageRules = this.get('packageRules');

    if (Array.isArray(value)) {
      this.setHard(
        'packageRules',
        Array.isArray(packageRules) ? packageRules.concat(value) : value
      );
    }
  }
}
