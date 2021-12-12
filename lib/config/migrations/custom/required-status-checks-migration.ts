import { AbstractMigration } from '../base/abstract-migration';

export class RequiredStatusChecksMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'requiredStatusChecks';

  run(value): void {
    if (value === null) {
      this.setSafely('ignoreTests', true);
    }
  }
}
