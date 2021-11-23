import { AbstractMigration } from '../base/abstract-migration';

export class RebaseConflictedPrs extends AbstractMigration {
  readonly propertyName = 'rebaseConflictedPrs';

  override run(value): void {
    this.delete();

    if (value === false) {
      this.setSafely('rebaseWhen', 'never');
    }
  }
}
