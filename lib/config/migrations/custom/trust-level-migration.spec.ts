import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      trustLevel: 'high',
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({
      allowCustomCrateRegistries: true,
      allowScripts: true,
      exposeAllEnv: true,
    });
  });

  it('should not rewrite provided properties', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      allowCustomCrateRegistries: false,
      allowScripts: false,
      exposeAllEnv: false,
      trustLevel: 'high',
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({
      allowCustomCrateRegistries: false,
      allowScripts: false,
      exposeAllEnv: false,
    });
  });
});
