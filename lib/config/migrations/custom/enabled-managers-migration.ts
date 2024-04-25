import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (!is.array<string>(value, is.string)) {
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
