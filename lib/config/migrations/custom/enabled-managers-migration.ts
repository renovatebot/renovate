import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';
import { isCustomManager } from '../../../modules/manager/custom';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array<string>(value, is.string)) {
      const newValue = value.map((manager) => {
        if (manager === 'yarn') {
          return 'npm';
        } else if (isCustomManager(manager)) {
          return `custom.${manager}`;
        }
        return manager;
      });
      this.rewrite(newValue);
    }
  }
}
