import { MatchDatasourcesMigration } from './match-datasources-migration';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', () => {
    expect(MatchDatasourcesMigration).toMigrate(
      {
        matchStrings: ['dotnet'],
      },
      {
        matchStrings: ['dotnet-version'],
      }
    );
  });
});
