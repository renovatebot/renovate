import { AbstractMigration } from '../base/abstract-migration';

export class TrustLevelMigration extends AbstractMigration {
  readonly propertyName = 'trustLevel';

  override run(): void {
    const {
      allowCustomCrateRegistries,
      allowScripts,
      exposeAllEnv,
      trustLevel,
    } = this.originalConfig;
    this.delete(this.propertyName);

    if (trustLevel === 'high') {
      this.migratedConfig.allowCustomCrateRegistries =
        allowCustomCrateRegistries ?? true;
      this.migratedConfig.allowScripts = allowScripts ?? true;
      this.migratedConfig.exposeAllEnv = exposeAllEnv ?? true;
    }
  }
}
