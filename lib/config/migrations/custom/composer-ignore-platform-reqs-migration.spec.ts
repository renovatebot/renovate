import { MigrationsService } from '../migrations-service';
import { ComposerIgnorePlatformReqsMigration } from './composer-ignore-platform-reqs-migration';

describe('config/migrations/custom/composer-ignore-platform-reqs-migration', () => {
  it('should migrate true to empty array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        composerIgnorePlatformReqs: true,
      },
      ComposerIgnorePlatformReqsMigration
    );

    expect(migratedConfig.composerIgnorePlatformReqs).toEqual([]);
  });

  it('should migrate false to null', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        composerIgnorePlatformReqs: false,
      },
      ComposerIgnorePlatformReqsMigration
    );

    expect(migratedConfig.composerIgnorePlatformReqs).toBeNull();
  });
});
