import is from '@sindresorhus/is';
import { getCustomManagerList } from '../../../modules/manager/custom';
import { AbstractMigration } from '../base/abstract-migration';

const customManagers = getCustomManagerList();

export class MatchManagersMigration extends AbstractMigration {
  override readonly propertyName = 'matchManagers';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value.filter(is.nonEmptyString).map((manager) => {
        if (isCustomManager(manager)) {
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
