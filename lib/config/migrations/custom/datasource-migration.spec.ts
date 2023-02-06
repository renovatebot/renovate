import { DatasourceMigration } from './datasource-migration';

describe('config/migrations/custom/datasource-migration', () => {
  it('should migrate properly', () => {
    expect(DatasourceMigration).toMigrate(
      {
        datasource: 'adoptium-java',
      },
      {
        datasource: 'java-version',
      }
    );
  });
});
