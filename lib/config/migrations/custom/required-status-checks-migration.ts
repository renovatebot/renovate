import { AbstractMigration } from '../base/abstract-migration';

export class RequiredStatusChecksMigration extends AbstractMigration {
  readonly propertyName = 'requiredStatusChecks';

  run(value): void {
    this.delete();

    if (value === null) {
      this.setSafely('ignoreTests', true);
    }
  }
}
