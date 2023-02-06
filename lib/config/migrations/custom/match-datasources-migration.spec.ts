import { MatchDatasourcesMigration } from './match-datasources-migration';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', () => {
    expect(MatchDatasourcesMigration).toMigrate(
      {
        matchDatasources: ['adoptium-java', 'dotnet'],
      },
      {
        matchDatasources: ['java-version', 'dotnet'],
      }
    );
  });
});
