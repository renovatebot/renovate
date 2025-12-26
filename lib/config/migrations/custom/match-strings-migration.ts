import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { trimSlashes } from '../../../util/url';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchStringsMigration extends AbstractMigration {
  override readonly propertyName = 'matchStrings';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value.filter(isNonEmptyString).map((matchString) => {
        let res = matchString.replace(
          regEx(/\(\?<lookupName>/g),
          '(?<packageName>',
        );

        if (res.startsWith('/') && res.endsWith('/')) {
          logger.warn(
            { matchString },
            'Found leading and trailing slashes in match string, removing them. "matchStrings" work fine without the slashes, please consider removing them',
          );
          res = trimSlashes(res);
        }
        return res;
      });

      this.rewrite(newValue);
    }
  }
}
