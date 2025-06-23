import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'rebaseStalePrs';

  override run(value: unknown): void {
    const rebaseConflictedPrs = this.get('rebaseConflictedPrs');

    if (rebaseConflictedPrs !== false) {
      if (is.boolean(value)) {
        this.setSafely(
          'rebaseWhen',
          value ? 'behind-base-branch' : 'conflicted',
        );
      }

      if (is.null_(value)) {
        this.setSafely('rebaseWhen', 'auto');
      }
    }
  }
}
