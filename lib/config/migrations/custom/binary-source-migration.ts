import { AbstractMigration } from '../base/abstract-migration';

export class BinarySourceMigration extends AbstractMigration {
  readonly propertyName = 'binarySource';

  override run(): void {
    if (this.originalConfig.binarySource === 'auto') {
      this.migratedConfig.binarySource = 'global';
    }
  }
}
