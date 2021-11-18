import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/pin-versions-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.run({
      pinVersions: true,
    });

    expect(migratedConfig.rangeStrategy).toBe('pin');
  });

  it('should migrate false', () => {
    const migratedConfig = MigrationsService.run({
      pinVersions: false,
    });

    expect(migratedConfig.rangeStrategy).toBe('replace');
  });
});
