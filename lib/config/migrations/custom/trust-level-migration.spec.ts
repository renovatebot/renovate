import { MigrationsService } from '../migrations-service';
import { TrustLevelMigration } from './trust-level-migration';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        trustLevel: 'high',
      },
      TrustLevelMigration
    );

    expect(migratedConfig).not.toHaveProperty('trustLevel');
    expect(migratedConfig.allowCustomCrateRegistries).toBeTrue();
    expect(migratedConfig.allowScripts).toBeTrue();
    expect(migratedConfig.exposeAllEnv).toBeTrue();
  });

  it('should not rewrite provided properties', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        allowCustomCrateRegistries: false,
        allowScripts: false,
        exposeAllEnv: false,
        trustLevel: 'high',
      },
      TrustLevelMigration
    );

    expect(migratedConfig).not.toHaveProperty('trustLevel');
    expect(migratedConfig.allowCustomCrateRegistries).toBeFalse();
    expect(migratedConfig.allowScripts).toBeFalse();
    expect(migratedConfig.exposeAllEnv).toBeFalse();
  });
});
