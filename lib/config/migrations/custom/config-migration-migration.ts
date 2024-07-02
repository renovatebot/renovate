import { AbstractMigration } from '../base/abstract-migration';

export class ConfigMigrationMigration extends AbstractMigration {
  override readonly propertyName = 'configMigration';

  override run(value: unknown): void {
    if (value === true) {
      this.rewrite('enabled');
    }
    if (value === false) {
      this.rewrite('disabled');
    }
  }
}
