import { AbstractMigration } from '../base/abstract-migration';

export class RebaseConflictedPrs extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'rebaseConflictedPrs';

  override run(value: unknown): void {
    if (value === false) {
      this.setSafely('rebaseWhen', 'never');
    }
  }
}
