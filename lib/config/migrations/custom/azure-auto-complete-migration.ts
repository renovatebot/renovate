import { AbstractMigration } from '../base/abstract-migration';

export class AzureAutoCompleteMigration extends AbstractMigration {
  readonly propertyName = 'azureAutoComplete';

  override run(value): void {
    this.delete();

    if (value !== undefined) {
      this.setSafely('platformAutomerge', value);
    }
  }
}
