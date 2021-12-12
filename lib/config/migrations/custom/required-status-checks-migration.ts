import { AbstractMigration } from '../base/abstract-migration';

export class RequiredStatusChecksMigration extends AbstractMigration {
  readonly propertyName = 'requiredStatusChecks';
  override readonly deprecated = true;

  run(value): void {
    if (value === null) {
      this.setSafely('ignoreTests', true);
    }
  }
}
