import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class SemanticPrefixMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'semanticPrefix';

  override run(value: unknown): void {
    if (is.string(value)) {
      const [text] = value.split(':');
      const [type, scope] = text.split('(');
      this.setSafely('semanticCommitType', type);
      this.setSafely('semanticCommitScope', scope ? scope.split(')')[0] : null);
    }
  }
}
