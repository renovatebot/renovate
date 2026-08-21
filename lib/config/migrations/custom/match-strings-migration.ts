import { isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class MatchStringsMigration extends AbstractMigration {
  override readonly propertyName = 'matchStrings';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (Array.isArray(value)) {
      const newValue = value
        .filter(isNonEmptyString)
        .map((matchString) =>
          matchString.replace(regEx(/\(\?<lookupName>/g), '(?<packageName>'),
        );

      this.rewrite(newValue);
    }
  }
}
