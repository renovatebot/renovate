import { AbstractMigration } from '../base/abstract-migration';

export class AzureGitLabAutomergeMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = /^azureAutoComplete$|^gitLabAutomerge$/;

  override run(value: unknown): void {
    if (value !== undefined) {
      this.setHard('platformAutomerge', value);
    }
  }
}
