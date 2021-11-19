import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RebaseStalePrsMigration extends AbstractMigration {
  readonly propertyName = 'rebaseStalePrs';

  override run(): void {
    const { rebaseStalePrs, rebaseConflictedPrs } = this.originalConfig;
    this.delete(this.propertyName);

    if (rebaseConflictedPrs !== false) {
      if (is.boolean(rebaseStalePrs)) {
        this.setSafely(
          'rebaseWhen',
          rebaseStalePrs ? 'behind-base-branch' : 'conflicted'
        );
      }

      if (is.null_(rebaseStalePrs)) {
        this.setSafely('rebaseWhen', 'auto');
      }
    }
  }
}
