import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseConflictedPrs extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('rebaseConflictedPrs', originalConfig, migratedConfig);
  }

  override run(): void {
    const { rebaseConflictedPrs } = this.originalConfig;
    this.delete(this.propertyName);

    if (rebaseConflictedPrs === false) {
      this.migratedConfig.rebaseWhen = 'never';
    }
  }
}
