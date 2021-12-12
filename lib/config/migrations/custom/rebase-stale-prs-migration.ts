import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  readonly propertyName = 'rebaseStalePrs';
  override readonly deprecated = true;

  override run(value): void {
    const rebaseConflictedPrs = this.get('rebaseConflictedPrs');

    if (rebaseConflictedPrs !== false) {
      if (is.boolean(value)) {
        this.setSafely(
          'rebaseWhen',
          value ? 'behind-base-branch' : 'conflicted'
        );
      }

      if (is.null_(value)) {
        this.setSafely('rebaseWhen', 'auto');
      }
    }
  }
}
