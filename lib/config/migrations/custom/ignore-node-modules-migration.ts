import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'ignoreNodeModules';

  override run(value): void {
    this.setSafely('ignorePaths', value ? ['node_modules/'] : []);
  }
}
