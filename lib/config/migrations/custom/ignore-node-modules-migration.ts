import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'ignoreNodeModules';

  override run(value: unknown): void {
    this.setSafely('ignorePaths', value ? ['node_modules/'] : []);
  }
}
