import type { CustomManager } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RegexManagersMigration extends AbstractMigration {
  override readonly propertyName = 'regexManagers';

  override run(value: unknown): void {
    let regexManagers = (value as CustomManager[]) ?? [];

    regexManagers = regexManagers.map((mgr) => {
      let newMgr = { ...mgr };
      if (!newMgr.customType) {
        newMgr = Object.assign({ customType: 'regex' }, newMgr); // to make sure customType is at top, looks good when migration pr is created
      }
      return newMgr;
    });

    this.rewrite(regexManagers);
  }
}
