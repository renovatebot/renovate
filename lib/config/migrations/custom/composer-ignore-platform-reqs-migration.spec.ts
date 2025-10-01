import { ComposerIgnorePlatformReqsMigration } from './composer-ignore-platform-reqs-migration';

describe('config/migrations/custom/composer-ignore-platform-reqs-migration', () => {
  it('should migrate true to empty array', async () => {
    await expect(ComposerIgnorePlatformReqsMigration).toMigrate(
      {
        composerIgnorePlatformReqs: true,
      },
      {
        composerIgnorePlatformReqs: [],
      },
    );
  });

  it('should migrate false to null', async () => {
    await expect(ComposerIgnorePlatformReqsMigration).toMigrate(
      {
        composerIgnorePlatformReqs: false,
      },
      {
        composerIgnorePlatformReqs: null,
      },
    );
  });

  it('should not change array value', async () => {
    await expect(ComposerIgnorePlatformReqsMigration).toMigrate(
      {
        composerIgnorePlatformReqs: [],
      },
      {
        composerIgnorePlatformReqs: [],
      },
      false,
    );
  });
});
