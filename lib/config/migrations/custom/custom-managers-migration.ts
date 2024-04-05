import is from '@sindresorhus/is';
import type { CustomManager } from '../../../modules/manager/custom/types';
import { AbstractMigration } from '../base/abstract-migration';

export class CustomManagersMigration extends AbstractMigration {
  override readonly propertyName = 'customManagers';

  override run(value: unknown): void {
    if (is.nonEmptyArray(value)) {
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
