import { FetchReleaseNotesMigration } from './fetch-release-notes-migration';

describe('config/migrations/custom/fetch-release-notes-migration', () => {
  it('migrates', () => {
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: false as never,
      },
      {
        fetchChangeLogs: 'off',
      },
    );
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: true as never,
      },
      {
        fetchChangeLogs: 'pr',
      },
    );
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'pr',
      },
      {
        fetchChangeLogs: 'pr',
      },
    );
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'off',
      },
      {
        fetchChangeLogs: 'off',
      },
    );
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: 'branch',
      },
      {
        fetchChangeLogs: 'branch',
      },
    );
  });
});
