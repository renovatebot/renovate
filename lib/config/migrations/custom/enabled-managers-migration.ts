import is from '@sindresorhus/is';
import { getCustomManagerList } from '../../../modules/manager/custom';
import { AbstractMigration } from '../base/abstract-migration';

const customManagers = getCustomManagerList();

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array(value)) {
      const newValue = value.filter(is.nonEmptyString).map((manager) => {
        if (manager === 'yarn') {
          return 'npm';
        } else if (isCustomManager(manager)) {
          return `custom.${manager}`;
        } else {
          return manager;
        }
      });
      this.rewrite(newValue);
    }
  }
}

function isCustomManager(manager: string): boolean {
  return customManagers.includes(manager);
}
