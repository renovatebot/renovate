import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class DatasourceMigration extends AbstractMigration {
  override readonly propertyName = 'datasource';

  override run(value: unknown): void {
    if (is.string(value)) {
      const newValue = migrateDatasource(value);
      this.rewrite(newValue);
    }
  }
}

export function migrateDatasource(value: string): string {
  switch (value) {
    case 'adoptium-java':
      return 'java-version';
    case 'dotnet':
      return 'dotnet-version';
    case 'node':
      return 'node-version';
  }
  return value;
}
