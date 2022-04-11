import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchStringsMigration extends AbstractMigration {
  override readonly propertyName = 'matchStrings';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(is.nonEmptyString)
        .map((matchString) =>
          matchString.replace(this.#lookupName, '(?<packageName>')
        );

      this.rewrite(newValue);
    }
  }

  #lookupName = /\(\?<lookupName>/g;
}
