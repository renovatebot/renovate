import { AbstractMigration } from '../base/abstract-migration.ts';

export class AzureGitLabAutomergeMigration extends AbstractMigration {
  override readonly deprecated = true;
  // oxlint-disable-next-line renovate/require-regex-util -- must stay a native RegExp: MigrationsService matches propertyName via isRegExp(), which RE2 instances fail
  override readonly propertyName = /^azureAutoComplete$|^gitLabAutomerge$/;

  override run(value: boolean | undefined): void {
    if (value !== undefined) {
      this.setHard('platformAutomerge', value);
    }
  }
}
