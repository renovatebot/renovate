import { AbstractMigration } from '../base/abstract-migration';

export class BinarySourceMigration extends AbstractMigration {
  readonly propertyName = 'binarySource';

  override run(value): void {
    if (value === 'auto') {
      this.migratedConfig.binarySource = 'global';
    }
  }
}
