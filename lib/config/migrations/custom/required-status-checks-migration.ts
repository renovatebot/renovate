import { AbstractMigration } from '../base/abstract-migration.ts';

export class RequiredStatusChecksMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'requiredStatusChecks';

  override run(value: unknown): void {
    if (value === null) {
      this.setSafely('ignoreTests', true);
    }
  }
}
