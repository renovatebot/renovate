import { MigrationsService } from '../migrations-service';
import { VersionStrategyMigration } from './version-strategy-migration';

describe('config/migrations/custom/version-strategy-migration', () => {
  it('should migrate versionStrategy="widen" to rangeStrategy="widen"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        upgradeInRange: true,
      },
      VersionStrategyMigration
    );

    expect(migratedConfig).not.toHaveProperty('versionStrategy');
    expect(migratedConfig.rangeStrategy).toBe('widen');
  });
});
