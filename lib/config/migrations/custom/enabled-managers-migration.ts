import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  readonly propertyName = 'enabledManagers';

  override run(): void {
    const { enabledManagers } = this.originalConfig;

    if (is.array(enabledManagers)) {
      // Replace yarn with npm, since yarn actually uses npm as package manager
      this.migratedConfig.enabledManagers = enabledManagers.map((manager) =>
        manager === 'yarn' ? 'npm' : manager
      );
    }
  }
}
