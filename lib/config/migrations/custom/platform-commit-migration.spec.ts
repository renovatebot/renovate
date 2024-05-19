import { PlatformCommitMigration } from './platform-commit-migration';

describe('config/migrations/custom/platform-commit-migration', () => {
  it('should migrate platformCommit=true to platformCommit=enabled', () => {
    expect(PlatformCommitMigration).toMigrate(
      {
        platformCommit: true as any,
      },
      {
        platformCommit: 'enabled',
      },
    );
  });

  it('should migrate platformCommit=false to platformCommit=disabled', () => {
    expect(PlatformCommitMigration).toMigrate(
      {
        platformCommit: false as any,
      },
      {
        platformCommit: 'disabled',
      },
    );
  });

  it('should not migrate platformCommit=auto', () => {
    expect(PlatformCommitMigration).not.toMigrate(
      {
        platformCommit: 'auto',
      },
      {
        platformCommit: 'auto',
      },
    );
  });
});
