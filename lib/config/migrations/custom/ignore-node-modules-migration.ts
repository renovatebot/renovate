import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  readonly propertyName = 'ignoreNodeModules';

  override run(value): void {
    this.delete(this.propertyName);

    this.migratedConfig.ignorePaths = value ? ['node_modules/'] : [];
  }
}
