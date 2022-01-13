import { AbstractMigration } from '../base/abstract-migration';

export class RebaseConflictedPrs extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'rebaseConflictedPrs';

  override run(value): void {
    if (value === false) {
      this.setSafely('rebaseWhen', 'never');
    }
  }
}
