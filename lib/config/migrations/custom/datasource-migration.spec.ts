import { DatasourceMigration } from './datasource-migration';

describe('config/migrations/custom/datasource-migration', () => {
  it('should migrate adoptium-java', async () => {
    await expect(DatasourceMigration).toMigrate(
      {
        datasource: 'adoptium-java',
      },
      {
        datasource: 'java-version',
      },
    );
  });

  it('should migrate donet', async () => {
    await expect(DatasourceMigration).toMigrate(
      {
        datasource: 'dotnet',
      },
      {
        datasource: 'dotnet-version',
      },
    );
  });

  it('should migrate node', async () => {
    await expect(DatasourceMigration).toMigrate(
      {
        datasource: 'node',
      },
      {
        datasource: 'node-version',
      },
    );
  });
});
