import { DatasourceMigration } from './datasource-migration';

describe('config/migrations/custom/datasource-migration', () => {
  it('should migrate properly', () => {
    expect(DatasourceMigration).toMigrate(
      {
        datasource: 'dotnet',
      },
      {
        datasource: 'dotnet-version',
      }
    );
  });
});
