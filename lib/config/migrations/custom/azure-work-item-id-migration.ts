import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AzureWorkItemIdMigration extends AbstractMigration {
  override readonly propertyName = 'azureWorkItemId';

  override run(value: unknown, key: string, parentKey?: string): void {
    if (is.integer(value) && parentKey !== 'prOptions') {
      const prOptions = this.get('prOptions') ?? {};
      this.delete();
      this.setHard('prOptions', {
        ...prOptions,
        azureWorkItemId: value,
      });
    }
  }
}
