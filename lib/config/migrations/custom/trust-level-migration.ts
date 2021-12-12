import { AbstractMigration } from '../base/abstract-migration';

export class TrustLevelMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'trustLevel';

  run(value): void {
    if (value === 'high') {
      this.setSafely('allowCustomCrateRegistries', true);
      this.setSafely('allowScripts', true);
      this.setSafely('exposeAllEnv', true);
    }
  }
}
