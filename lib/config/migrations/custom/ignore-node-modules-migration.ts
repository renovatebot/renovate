import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  readonly propertyName = 'ignoreNodeModules';
  override readonly deprecated = true;

  run(value): void {
    this.setSafely('ignorePaths', value ? ['node_modules/'] : []);
  }
}
