import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticCommitsMigration extends AbstractMigration {
  readonly propertyName = 'semanticCommits';

  override run(value): void {
    if (is.boolean(value)) {
      this.migratedConfig.semanticCommits = value ? 'enabled' : 'disabled';
    } else if (value !== 'enabled' && value !== 'disabled') {
      this.migratedConfig.semanticCommits = 'auto';
    }
  }
}
