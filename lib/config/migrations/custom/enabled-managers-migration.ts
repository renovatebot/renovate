import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array(value)) {
      const newValue = value.map((manager) => {
        switch (manager) {
          case 'yarn':
            return 'npm';
          case 'regex':
            return 'custom';
          default:
            return manager;
        }
      });
      this.rewrite(newValue);
    }
  }
}
