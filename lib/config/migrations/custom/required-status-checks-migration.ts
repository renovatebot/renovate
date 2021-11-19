import { AbstractMigration } from '../base/abstract-migration';

export class RequiredStatusChecksMigration extends AbstractMigration {
  readonly propertyName = 'requiredStatusChecks';

  override run(): void {
    this.delete(this.propertyName);

    if (this.originalConfig.requiredStatusChecks === null) {
      this.migratedConfig.ignoreTests = true;
    }
  }
}
