import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class DatasourceMigration extends AbstractMigration {
  override readonly propertyName = 'datasource';

  override run(value: unknown): void {
    if (is.string(value)) {
      let newValue: string;
      switch (value) {
        case 'adoptium-java':
          newValue = 'java-version';
          break;
        case 'dotnet':
          newValue = 'dotnet-version';
          break;
        default:
          newValue = value;
      }

      this.rewrite(newValue);
    }
  }
}
