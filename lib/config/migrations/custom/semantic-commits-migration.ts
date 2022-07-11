import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticCommitsMigration extends AbstractMigration {
  override readonly propertyName = 'semanticCommits';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.rewrite(value ? 'enabled' : 'disabled');
    } else if (value !== 'enabled' && value !== 'disabled') {
      this.rewrite('auto');
    }
  }
}
