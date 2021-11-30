import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchManagersMigration extends AbstractMigration {
  readonly propertyName = 'matchManagers';

  override run(value): void {
    if (is.nonEmptyArray(value)) {
      if (value.includes('gradle-lite')) {
        const newValue = value.filter((manager) => manager !== 'gradle-lite');

        if (!newValue.includes('gradle')) {
          newValue.push('gradle');
        }

        this.rewrite(newValue);
      }
    }
  }
}
