import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', () => {
    const migratedConfig = MigrationsService.run({
      trustLevel: 'high',
    });

    expect(migratedConfig.allowCustomCrateRegistries).toBeTrue();
    expect(migratedConfig.allowScripts).toBeTrue();
    expect(migratedConfig.exposeAllEnv).toBeTrue();
  });

  it('should not rewrite provided properties', () => {
    const migratedConfig = MigrationsService.run({
      allowCustomCrateRegistries: false,
      allowScripts: false,
      exposeAllEnv: false,
      trustLevel: 'high',
    });

    expect(migratedConfig.allowCustomCrateRegistries).toBeFalse();
    expect(migratedConfig.allowScripts).toBeFalse();
    expect(migratedConfig.exposeAllEnv).toBeFalse();
  });
});
