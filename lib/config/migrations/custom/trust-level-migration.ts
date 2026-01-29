import { AbstractMigration } from '../base/abstract-migration.ts';

export class TrustLevelMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'trustLevel';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (value === 'high') {
      this.setSafely('allowCustomCrateRegistries', true);
      this.setSafely('allowScripts', true);
      this.setSafely('exposeAllEnv', true);
    }
  }
}
