import { ComposerIgnorePlatformReqsMigration } from './composer-ignore-platform-reqs-migration';

describe('config/migrations/custom/composer-ignore-platform-reqs-migration', () => {
  it('should migrate true to empty array', () => {
    expect(ComposerIgnorePlatformReqsMigration).toMigrate(
      {
        composerIgnorePlatformReqs: true,
      },
      {
        composerIgnorePlatformReqs: [],
      },
    );
  });

  it('should migrate false to null', () => {
    expect(ComposerIgnorePlatformReqsMigration).toMigrate(
      {
        composerIgnorePlatformReqs: false,
      },
      {
        composerIgnorePlatformReqs: null,
      },
    );
  });

  it('should not change array value', () => {
    expect(ComposerIgnorePlatformReqsMigration).toMigrate(
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
