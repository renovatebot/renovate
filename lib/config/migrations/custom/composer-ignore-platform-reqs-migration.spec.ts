import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/composer-ignore-platform-reqs-migration', () => {
  it('should migrate true to empty array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      composerIgnorePlatformReqs: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig.composerIgnorePlatformReqs).toStrictEqual([]);
  });

  it('should migrate false to null', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      composerIgnorePlatformReqs: false,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig.composerIgnorePlatformReqs).toBeNull();
  });

  it('should not migrate array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      composerIgnorePlatformReqs: [],
    });

    expect(isMigrated).toBeFalse();
    expect(migratedConfig.composerIgnorePlatformReqs).toStrictEqual([]);
  });
});
