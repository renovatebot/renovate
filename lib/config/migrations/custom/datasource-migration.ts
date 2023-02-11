import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class DatasourceMigration extends AbstractMigration {
  override readonly propertyName = 'datasource';

  override run(value: unknown): void {
    if (is.string(value)) {
      const newValue = value === 'dotnet' ? 'dotnet-version' : value;

      this.rewrite(newValue);
    }
  }
}
