import { AbstractMigration } from '../base/abstract-migration';

export class AzureAutoCompleteMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'azureAutoComplete';

  override run(value: unknown): void {
    if (value !== undefined) {
      this.setHard('platformAutomerge', value);
    }
  }
}
