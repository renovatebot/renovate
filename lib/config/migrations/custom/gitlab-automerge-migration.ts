import { AbstractMigration } from '../base/abstract-migration';

export class GitLabAutomergeMigration extends AbstractMigration {
  readonly propertyName = 'gitLabAutomerge';

  override run(value): void {
    this.delete();

    if (value !== undefined) {
      this.setSafely('platformAutomerge', value);
    }
  }
}
