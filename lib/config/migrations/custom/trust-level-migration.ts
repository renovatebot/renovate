import { AbstractMigration } from '../base/abstract-migration';

export class TrustLevelMigration extends AbstractMigration {
  readonly propertyName = 'trustLevel';

  override run(value): void {
    this.delete();

    if (value === 'high') {
      this.setSafely('allowCustomCrateRegistries', true);
      this.setSafely('allowScripts', true);
      this.setSafely('exposeAllEnv', true);
    }
  }
}
