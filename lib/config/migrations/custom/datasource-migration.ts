import { isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class DatasourceMigration extends AbstractMigration {
  override readonly propertyName = 'datasource';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (isString(value)) {
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
