import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchStringsMigration extends AbstractMigration {
  override readonly propertyName = 'matchStrings';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(is.nonEmptyString)
        .map((matchString) =>
          matchString.replace(regEx(/\(\?<lookupName>/g), '(?<packageName>'),
        );

      this.rewrite(newValue);
    }
  }
}
