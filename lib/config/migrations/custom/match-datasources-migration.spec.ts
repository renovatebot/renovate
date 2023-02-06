import { MatchDatasourcesMigration } from './match-datasources-migration';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', () => {
    expect(MatchDatasourcesMigration).toMigrate(
      {
        matchDatasources: ['dotnet'],
      },
      {
        matchDatasources: ['dotnet-version'],
      }
    );
  });
});
