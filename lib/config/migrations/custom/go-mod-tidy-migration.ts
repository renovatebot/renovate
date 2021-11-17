import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class GoModTidyMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('gomodTidy', originalConfig, migratedConfig);
  }

  override run(): void {
    const { gomodTidy, postUpdateOptions } = this.originalConfig;

    this.delete(this.propertyName);

    if (gomodTidy) {
      this.migratedConfig.postUpdateOptions ??= postUpdateOptions ?? [];
      this.migratedConfig.postUpdateOptions.push('gomodTidy');
    }
  }
}
