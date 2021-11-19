import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  readonly propertyName = 'ignoreNodeModules';

  override run(): void {
    this.delete(this.propertyName);

    this.migratedConfig.ignorePaths = this.originalConfig.ignoreNodeModules
      ? ['node_modules/']
      : [];
  }
}
