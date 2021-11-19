import { AbstractMigration } from '../base/abstract-migration';

export class TrustLevelMigration extends AbstractMigration {
  readonly propertyName = 'trustLevel';

  override run(): void {
    const { trustLevel } = this.originalConfig;
    this.delete(this.propertyName);

    if (trustLevel === 'high') {
      this.setSafely('allowCustomCrateRegistries', true);
      this.setSafely('allowScripts', true);
      this.setSafely('exposeAllEnv', true);
    }
  }
}
