import type { RenovateConfig } from '../../types';
import { TrustLevelMigration } from './trust-level-migration';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', () => {
    const originalConfig: RenovateConfig = {
      trustLevel: 'high',
    };
    const migratedConfig: RenovateConfig = {};
    const migration = new TrustLevelMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.allowCustomCrateRegistries).toBeTrue();
    expect(migratedConfig.allowScripts).toBeTrue();
    expect(migratedConfig.exposeAllEnv).toBeTrue();
  });

  it('should not rewrite provided properties', () => {
    const originalConfig: RenovateConfig = {
      allowCustomCrateRegistries: false,
      allowScripts: false,
      exposeAllEnv: false,
      trustLevel: 'high',
    };
    const migratedConfig: RenovateConfig = {};
    const migration = new TrustLevelMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.allowCustomCrateRegistries).toBeFalse();
    expect(migratedConfig.allowScripts).toBeFalse();
    expect(migratedConfig.exposeAllEnv).toBeFalse();
  });
});
