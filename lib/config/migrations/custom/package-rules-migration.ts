import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PackageRulesMigration extends AbstractMigration {
  readonly propertyName = 'packageRules';

  override run(value): void {
    const packageRules = this.get('packageRules');

    if (is.plainObject(value)) {
      const newValue = Array.isArray(packageRules)
        ? packageRules.concat([value])
        : [value];
      this.rewrite(newValue);
    }
  }
}
