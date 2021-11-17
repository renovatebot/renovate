import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class TrustLevelMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('trustLevel', originalConfig, migratedConfig);
  }

  override run(): void {
    this.delete(this.propertyName);

    if (this.originalConfig.trustLevel === 'high') {
      this.migratedConfig.allowCustomCrateRegistries =
        this.originalConfig.allowCustomCrateRegistries ?? true;
      this.migratedConfig.allowScripts =
        this.originalConfig.allowScripts ?? true;
      this.migratedConfig.exposeAllEnv =
        this.originalConfig.exposeAllEnv ?? true;
    }
  }
}
