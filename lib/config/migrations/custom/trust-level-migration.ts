import { AbstractMigration } from '../base/abstract-migration';
import type { DeprecatedRenovateConfig } from '../types';

export class TrustLevelMigration extends AbstractMigration<DeprecatedRenovateConfig> {
  override readonly deprecated = true;
  override readonly propertyName = 'trustLevel';

  override run(value: unknown): void {
    if (value === 'high') {
      this.setSafely('allowCustomCrateRegistries', true);
      this.setSafely('allowScripts', true);
      this.setSafely('exposeAllEnv', true);
    }
  }
}
