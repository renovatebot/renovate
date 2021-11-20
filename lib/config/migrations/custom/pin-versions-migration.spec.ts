import { MigrationsService } from '../migrations-service';
import { PinVersionsMigration } from './pin-versions-migration';

describe('config/migrations/custom/pin-versions-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        pinVersions: true,
      },
      PinVersionsMigration
    );

    expect(migratedConfig.rangeStrategy).toBe('pin');
  });

  it('should migrate false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        pinVersions: false,
      },
      PinVersionsMigration
    );

    expect(migratedConfig.rangeStrategy).toBe('replace');
  });
});
