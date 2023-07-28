import { MatchManagersMigration } from './match-managers-migration';

describe('config/migrations/custom/match-managers-migration', () => {
  it('should migrate properly', () => {
    expect(MatchManagersMigration).toMigrate(
      {
        matchManagers: ['npm', 'regex'],
      },
      {
        matchManagers: ['npm', 'custom.regex'],
      }
    );
  });
});
