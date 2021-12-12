import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  readonly propertyName = 'enabledManagers';

  run(value: string[]): void {
    if (is.array(value)) {
      const newValue = value.map((manager) =>
        manager === 'yarn' ? 'npm' : manager
      );
      this.rewrite(newValue);
    }
  }
}
