import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RequiredStatusChecksMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('requiredStatusChecks', originalConfig, migratedConfig);
  }

  override run(): void {
    this.delete(this.propertyName);

    if (this.originalConfig.requiredStatusChecks === null) {
      this.migratedConfig.ignoreTests = true;
    }
  }
}
