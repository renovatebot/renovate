import { AbstractMigration } from '../base/abstract-migration';

export class GitLabAutomergeMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'gitLabAutomerge';

  override run(value: unknown): void {
    if (value !== undefined) {
      this.setHard('platformAutomerge', value);
    }
  }
}
