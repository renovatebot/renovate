import { MatchDatasourcesMigration } from './match-datasources-migration';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', () => {
    expect(MatchDatasourcesMigration).toMigrate(
      {
        matchDatasources: ['adoptium-java', 'crate', 'dotnet', 'npm', 'node'],
      },
      {
        matchDatasources: [
          'java-version',
          'crates-io',
          'dotnet-version',
          'npm',
          'node-version',
        ],
      }
    );
  });
});
