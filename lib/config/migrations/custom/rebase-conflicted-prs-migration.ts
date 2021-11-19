import { AbstractMigration } from '../base/abstract-migration';

export class RebaseConflictedPrs extends AbstractMigration {
  readonly propertyName = 'rebaseConflictedPrs';

  override run(): void {
    const { rebaseConflictedPrs } = this.originalConfig;
    this.delete(this.propertyName);

    if (rebaseConflictedPrs === false) {
      this.setSafely('rebaseWhen', 'never');
    }
  }
}
