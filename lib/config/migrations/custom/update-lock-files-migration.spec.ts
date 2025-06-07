import { UpdateLockFilesMigration } from './update-lock-files-migration';

describe('config/migrations/custom/update-lock-files-migration', () => {
  it('should replace false value', () => {
    expect(UpdateLockFilesMigration).toMigrate(
      {
        updateLockFiles: false,
      },
      {
        skipArtifactsUpdate: true,
      },
    );
  });

  it('should not replace true value', () => {
    expect(UpdateLockFilesMigration).toMigrate(
      {
        updateLockFiles: true,
      },
      {},
    );
  });

  it('should not replace skipArtifactsUpdate', () => {
    expect(UpdateLockFilesMigration).toMigrate(
      {
        updateLockFiles: false,
        skipArtifactsUpdate: false,
      },
      {
        skipArtifactsUpdate: false,
      },
    );
  });
});
