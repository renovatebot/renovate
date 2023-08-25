import is from '@sindresorhus/is';
import { isCustomManager } from '../../../modules/manager/custom';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array<string>(value, is.string)) {
      const newValue = value.map((manager) => {
        if (manager === 'yarn') {
          return 'npm';
        }

        if (isCustomManager(manager)) {
          return `custom.${manager}`;
        }

        return manager;
      });
      this.rewrite(newValue);
    }
  }
}
