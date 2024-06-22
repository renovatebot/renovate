import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchDatasourcesMigration extends AbstractMigration {
  override readonly propertyName = 'matchDatasources';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value.filter(is.nonEmptyString).map((datasource) => {
        switch (datasource) {
          case 'adoptium-java':
            return 'java-version';
          case 'dotnet':
            return 'dotnet-version';
          case 'node':
            return 'node-version';
          default:
            return datasource;
        }
      });

      this.rewrite(newValue);
    }
  }
}
