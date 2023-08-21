import is from '@sindresorhus/is';
import type { CustomManager } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RegexManagersMigration extends AbstractMigration {
  override readonly propertyName = 'regexManagers';

  override run(value: unknown): void {
    if (is.nonEmptyArray(value)) {
      let regexManagers = value as CustomManager[];

      regexManagers = regexManagers.map((mgr) => {
        if (!mgr.customType) {
          return Object.assign({ customType: 'regex' }, mgr); // to make sure customType is at top, looks good when migration pr is created
        } else {
          return mgr;
        }
      });

      this.rewrite(regexManagers);
    }
  }
}
