import { isNonEmptyArray } from '@sindresorhus/is';
import type { CustomManager } from '../../../modules/manager/custom/types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class CustomManagersMigration extends AbstractMigration {
  override readonly propertyName = 'customManagers';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (isNonEmptyArray(value)) {
      const customManagers = (value as CustomManager[]).map((mgr) => {
        if (mgr.customType) {
          return mgr;
        }
        return Object.assign({ customType: 'regex' }, mgr); // to make sure customType is at top, looks good when migration PR is created
      });

      this.rewrite(customManagers);
    }
  }
}
