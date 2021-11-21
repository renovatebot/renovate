import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  readonly propertyName = 'enabledManagers';

  override run(value: string[]): void {
    if (is.array(value)) {
      // Replace yarn with npm, since yarn actually uses npm as package manager
      this.migratedConfig.enabledManagers = value.map((manager) =>
        manager === 'yarn' ? 'npm' : manager
      );
    }
  }
}
