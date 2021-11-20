import { MigrationsService } from '../migrations-service';
import { UpgradeInRangeMigration } from './upgrade-in-range-migration';

describe('config/migrations/custom/upgrade-in-range-migration', () => {
  it('should migrate upgradeInRange=true to rangeStrategy="bump"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        upgradeInRange: true,
      },
      UpgradeInRangeMigration
    );

    expect(migratedConfig).not.toHaveProperty('upgradeInRange');
    expect(migratedConfig.rangeStrategy).toBe('bump');
  });
});
