import { DatasourceMigration } from './datasource-migration';

describe('config/migrations/custom/datasource-migration', () => {
  it('should migrate adoptium-java', () => {
    expect(DatasourceMigration).toMigrate(
      {
        datasource: 'adoptium-java',
      },
      {
        datasource: 'java-version',
      },
    );
  });

  it('should migrate donet', () => {
    expect(DatasourceMigration).toMigrate(
      {
        datasource: 'dotnet',
      },
      {
        datasource: 'dotnet-version',
      },
    );
  });

  it('should migrate node', () => {
    expect(DatasourceMigration).toMigrate(
      {
        datasource: 'node',
      },
      {
        datasource: 'node-version',
      },
    );
  });
});
