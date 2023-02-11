import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchDatasourcesMigration extends AbstractMigration {
  override readonly propertyName = 'matchDatasources';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(is.nonEmptyString)
        .map((datasource) =>
          { 
         if(datasource === 'adoptium-java') return 'java-version'
           if(datasource === 'dotnet') return 'dotnet-version'
           return datasource;
          }
        );

      this.rewrite(newValue);
    }
  }
}
