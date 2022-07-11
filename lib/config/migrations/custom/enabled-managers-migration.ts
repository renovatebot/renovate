import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array(value)) {
      const newValue = value.map((manager) =>
        manager === 'yarn' ? 'npm' : manager
      );
      this.rewrite(newValue);
    }
  }
}
