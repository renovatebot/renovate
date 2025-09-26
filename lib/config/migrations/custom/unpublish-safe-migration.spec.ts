import { UnpublishSafeMigration } from './unpublish-safe-migration';

describe('config/migrations/custom/unpublish-safe-migration', () => {
  it('should migrate true', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        unpublishSafe: true,
      },
      {
        extends: ['security:minimumReleaseAgeNpm'],
      },
    );
  });

  it('should migrate true and handle extends field', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: 'test',
        unpublishSafe: true,
      } as any,
      {
        extends: ['test', 'security:minimumReleaseAgeNpm'],
      },
    );
  });

  it('should migrate true and handle empty extends field', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: [],
        unpublishSafe: true,
      } as any,
      {
        extends: ['security:minimumReleaseAgeNpm'],
      },
    );
  });

  it('should migrate true and save order of items inside extends field', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', ':unpublishSafe', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'security:minimumReleaseAgeNpm', 'bar'],
      },
    );

    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'default:unpublishSafe', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'security:minimumReleaseAgeNpm', 'bar'],
      },
    );

    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'security:minimumReleaseAgeNpm', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'security:minimumReleaseAgeNpm', 'bar'],
      },
    );
  });

  it('should migrate false and save order of items inside extends field', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'bar'],
        unpublishSafe: false,
      } as any,
      {
        extends: ['foo', 'bar'],
      },
    );
  });

  it('prevent duplicates', async () => {
    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['security:minimumReleaseAgeNpm'],
        unpublishSafe: true,
      },
      {
        extends: ['security:minimumReleaseAgeNpm'],
      },
    );
  });

  it('should not migrate npm:unpublishSafe', async () => {
    // NOTE that this preset name is now deprecated, but will be handled by `ExtendsMigration` instead of handled in this migration

    await expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['npm:unpublishSafe'],
      },
      {
        extends: ['npm:unpublishSafe'],
      },
      false,
    );
  });
});
