import { isBoolean } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'rebaseStalePrs';

  override run(value: unknown): void {
    const rebaseConflictedPrs = this.get('rebaseConflictedPrs');

    if (rebaseConflictedPrs !== false) {
      if (isBoolean(value)) {
        this.setSafely(
          'rebaseWhen',
          value ? 'behind-base-branch' : 'conflicted',
        );
      }

      if (null === value) {
        this.setSafely('rebaseWhen', 'auto');
      }
    }
  }
}
