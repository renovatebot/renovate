import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class EnabledManagersMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('enabledManagers', originalConfig, migratedConfig);
  }

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
