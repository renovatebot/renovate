import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'rebaseStalePrs';

  override run(value): void {
    const rebaseConflictedPrs = this.get('rebaseConflictedPrs');

    if (rebaseConflictedPrs) {
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
