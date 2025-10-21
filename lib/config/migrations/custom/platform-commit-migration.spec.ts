import { PlatformCommitMigration } from './platform-commit-migration';

describe('config/migrations/custom/platform-commit-migration', () => {
  it('should migrate platformCommit=true to platformCommit=enabled', async () => {
    await expect(PlatformCommitMigration).toMigrate(
      {
        // @ts-expect-error: old type
        platformCommit: true,
      },
      {
        platformCommit: 'enabled',
      },
    );
  });

  it('should migrate platformCommit=false to platformCommit=disabled', async () => {
    await expect(PlatformCommitMigration).toMigrate(
      {
        // @ts-expect-error: old type
        platformCommit: false,
      },
      {
        platformCommit: 'disabled',
      },
    );
  });

  it('should not migrate platformCommit=auto', async () => {
    await expect(PlatformCommitMigration).not.toMigrate(
      {
        platformCommit: 'auto',
      },
      {
        platformCommit: 'auto',
      },
    );
  });
});
