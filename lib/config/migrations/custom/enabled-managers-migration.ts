import { isArray, isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (!isArray<string>(value, isString)) {
      return;
    }

    const newValue = value.map((manager) => {
      switch (manager) {
        case 'yarn':
          return 'npm';
        case 'regex':
          return 'custom.regex';
        default:
          return manager;
      }
    });
    this.rewrite(newValue);
  }
}
