import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class BinarySourceMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('binarySource', originalConfig, migratedConfig);
  }

  override run(): void {
    if (this.originalConfig.binarySource === 'auto') {
      this.migratedConfig.binarySource = 'global';
    }
  }
}
