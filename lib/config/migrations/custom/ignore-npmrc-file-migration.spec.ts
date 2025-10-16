import { IgnoreNpmrcFileMigration } from './ignore-npmrc-file-migration';

describe('config/migrations/custom/ignore-npmrc-file-migration', () => {
  it('should init npmrc field', async () => {
    await expect(IgnoreNpmrcFileMigration).toMigrate(
      {
        ignoreNpmrcFile: true,
      },
      {
        npmrc: '',
      },
    );
  });

  it('should not change npmrc field if it represents string value', async () => {
    await expect(IgnoreNpmrcFileMigration).toMigrate(
      {
        ignoreNpmrcFile: true,
        npmrc: '',
      },
      {
        npmrc: '',
      },
    );
  });

  it('should change npmrc field if it not represents string value', async () => {
    await expect(IgnoreNpmrcFileMigration).toMigrate(
      {
        ignoreNpmrcFile: true,
        npmrc: true,
      } as any,
      {
        npmrc: '',
      },
    );
  });
});
