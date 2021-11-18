import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticCommitsMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('semanticCommits', originalConfig, migratedConfig);
  }

  override run(): void {
    const { semanticCommits } = this.originalConfig;

    if (is.boolean(semanticCommits)) {
      this.migratedConfig.semanticCommits = semanticCommits
        ? 'enabled'
        : 'disabled';
    } else if (
      semanticCommits !== 'enabled' &&
      semanticCommits !== 'disabled'
    ) {
      this.migratedConfig.semanticCommits = 'auto';
    }
  }
}
