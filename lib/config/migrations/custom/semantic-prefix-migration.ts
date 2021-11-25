import is from '@sindresorhus/is';
import { SemanticCommitMessage } from '../../../workers/repository/model/semantic-commit-message';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticPrefixMigration extends AbstractMigration {
  readonly propertyName = 'semanticPrefix';

  override run(value): void {
    if (!is.string(value)) {
      return;
    }

    this.delete();

    try {
      const semanticCommitMessage = SemanticCommitMessage.fromString(value);
      this.setSafely('semanticCommitType', semanticCommitMessage.type);
      this.setSafely(
        'semanticCommitScope',
        semanticCommitMessage.scope ?? null
      );
    } catch {
      this.setSafely('semanticCommitType', value);
      this.setSafely('semanticCommitScope', null);
    }
  }
}
