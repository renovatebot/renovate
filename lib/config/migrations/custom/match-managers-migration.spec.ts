import { MatchManagersMigration } from './match-managers-migration';

describe('config/migrations/custom/match-managers-migration', () => {
  it('migrates old custom manager syntax to new one', async () => {
    await expect(MatchManagersMigration).toMigrate(
      {
        matchManagers: ['npm', 'regex', 'custom.regex', 'custom.someMgr'],
      },
      {
        matchManagers: [
          'npm',
          'custom.regex',
          'custom.regex',
          'custom.someMgr',
        ],
      },
    );
  });

  // coverage
  it('only migrates when necessary', async () => {
    await expect(MatchManagersMigration).not.toMigrate(
      {
        matchManagers: undefined,
      },
      {
        matchManagers: undefined,
      },
    );
  });
});
