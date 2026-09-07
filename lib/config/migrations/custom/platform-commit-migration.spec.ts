import { PlatformCommitMigration } from './platform-commit-migration.ts';

describe('config/migrations/custom/platform-commit-migration', () => {
  it('should migrate platformCommit=true to platformCommit=enabled', async () => {
    await expect(PlatformCommitMigration).toMigrate(
      {
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
        platformCommit: false,
      },
      {
        platformCommit: 'disabled',
      },
    );
  });

  it.each`
    value      | expected
    ${'true'}  | ${'enabled'}
    ${'false'} | ${'disabled'}
  `(
    'should migrate platformCommit=$value to $expected',
    async ({ value, expected }) => {
      await expect(PlatformCommitMigration).toMigrate(
        { platformCommit: value },
        { platformCommit: expected },
      );
    },
  );

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
