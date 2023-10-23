import { FetchChangeLogsMigration } from './fetch-release-notes-migration';

describe('config/migrations/custom/fetch-release-notes-migration', () => {
  it('migrates', () => {
    expect(FetchChangeLogsMigration).toMigrate(
      {
        fetchChangeLogs: false as never,
      },
      {
        fetchChangeLogs: 'off',
      }
    );
    expect(FetchChangeLogsMigration).toMigrate(
      {
        fetchChangeLogs: true as never,
      },
      {
        fetchChangeLogs: 'pr',
      }
    );
  });
});
