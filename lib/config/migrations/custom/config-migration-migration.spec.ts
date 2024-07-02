import { ConfigMigrationMigration } from './config-migration-migration';

describe('config/migrations/custom/config-migration-migration', () => {
  it('should migrate true to enabled', () => {
    expect(ConfigMigrationMigration).toMigrate(
      {
        // @ts-expect-error invalid options
        configMigration: true,
      },
      {
        configMigration: 'enabled',
      },
    );
  });

  it('should migrate false to disabled', () => {
    expect(ConfigMigrationMigration).toMigrate(
      {
        // @ts-expect-error invalid options
        configMigration: false,
      },
      {
        configMigration: 'disabled',
      },
    );
  });

  it('should not migrate', () => {
    expect(ConfigMigrationMigration).toMigrate(
      {
        configMigration: 'auto',
      },
      {
        configMigration: 'auto',
      },
      false,
    );
  });
});
