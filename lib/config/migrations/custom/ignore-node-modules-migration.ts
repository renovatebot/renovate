import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNodeModulesMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('ignoreNodeModules', originalConfig, migratedConfig);
  }

  override run(): void {
    this.delete(this.propertyName);

    this.migratedConfig.ignorePaths = this.originalConfig.ignoreNodeModules
      ? ['node_modules/']
      : [];
  }
}
