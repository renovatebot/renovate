import { MatchDatasourcesMigration } from './match-datasources-migration.ts';

describe('config/migrations/custom/match-datasources-migration', () => {
  it('should migrate properly', async () => {
    await expect(MatchDatasourcesMigration).toMigrate(
      {
        matchDatasources: ['adoptium-java', 'dotnet', 'npm', 'node'],
      },
      {
        matchDatasources: [
          'java-version',
          'dotnet-version',
          'npm',
          'node-version',
        ],
      },
    );
  });
});
