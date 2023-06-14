import { FetchReleaseNotes } from './fetch-release-notes-migration';
describe('config/migrations/custom/fetch-release-notes-migration', () => {
  it('migrates', () => {
    expect(FetchReleaseNotes).toMigrate(
      {
        fetchReleaseNotes: false as never,
      },
      {
        fetchReleaseNotes: 'off',
      }
    );
    expect(FetchReleaseNotes).toMigrate(
      {
        fetchReleaseNotes: true as never,
      },
      {
        fetchReleaseNotes: 'pr',
      }
    );
  });
});
