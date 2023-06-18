import { FetchReleaseNotesMigration } from './fetch-release-notes-migration';

describe('config/migrations/custom/fetch-release-notes-migration', () => {
  it('migrates', () => {
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: false as never,
      },
      {
        fetchReleaseNotes: 'off',
      }
    );
    expect(FetchReleaseNotesMigration).toMigrate(
      {
        fetchReleaseNotes: true as never,
      },
      {
        fetchReleaseNotes: 'pr',
      }
    );
  });
});
