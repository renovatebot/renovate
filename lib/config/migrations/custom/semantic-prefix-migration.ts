import is from '@sindresorhus/is';
import { SemanticCommitMessage } from '../../../workers/repository/model/semantic-commit-message';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticPrefixMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'semanticPrefix';

  override run(value: unknown): void {
    if (is.string(value)) {
      const semanticCommitMessage = SemanticCommitMessage.fromString(value);
      if (SemanticCommitMessage.is(semanticCommitMessage)) {
        const { scope, type } = semanticCommitMessage.toJSON();
        this.setSafely('semanticCommitType', type);
        this.setSafely(
          'semanticCommitScope',
          is.emptyString(scope) ? null : scope
        );
      } else {
        this.setSafely('semanticCommitType', value);
        this.setSafely('semanticCommitScope', null);
      }
    }
  }
}
