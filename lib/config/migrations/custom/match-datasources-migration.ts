import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchDatasourcesMigration extends AbstractMigration {
  override readonly propertyName = 'matchDatasources';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(is.nonEmptyString)
        .map((datasource) =>
          datasource === 'dotnet' ? 'dotnet-version' : datasource
        );

      this.rewrite(newValue);
    }
  }
}
