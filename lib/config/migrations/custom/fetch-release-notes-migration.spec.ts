import { FetchReleaseNotesMigration } from './fetch-release-notes-migration';

describe('config/migrations/custom/fetch-release-notes-migration', () => {
  it('migrates', async () => {
    await expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: false as never,
      },
      {
        fetchChangeLogs: 'off',
      },
    );
    await expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: true as never,
      },
      {
        fetchChangeLogs: 'pr',
      },
    );
    await expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'pr',
      },
      {
        fetchChangeLogs: 'pr',
      },
    );
    await expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'off',
      },
      {
        fetchChangeLogs: 'off',
      },
    );
    await expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'branch',
      },
      {
        fetchChangeLogs: 'branch',
      },
    );
  });
});
