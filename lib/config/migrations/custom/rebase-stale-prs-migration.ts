import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('rebaseStalePrs', originalConfig, migratedConfig);
  }

  override run(): void {
    const { rebaseStalePrs, rebaseConflictedPrs, rebaseWhen } =
      this.originalConfig;
    this.delete(this.propertyName);

    if (!rebaseWhen && rebaseConflictedPrs !== false) {
      if (is.boolean(rebaseStalePrs)) {
        this.migratedConfig.rebaseWhen = rebaseStalePrs
          ? 'behind-base-branch'
          : 'conflicted';
      }

      if (is.null_(rebaseStalePrs)) {
        this.migratedConfig.rebaseWhen = 'auto';
      }
    }
  }
}
