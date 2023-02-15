import { MatchDatasourcesMigration } from './match-datasources-migration';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', () => {
    expect(MatchDatasourcesMigration).toMigrate(
      {
        matchDatasources: ['adoptium-java', 'dotnet', 'npm'],
      },
      {
        matchDatasources: ['java-version', 'dotnet-version', 'npm'],
      }
    );
  });
});
