import { RequireConfigMigration } from './require-config-migration';

describe('config/migrations/custom/require-config-migration', () => {
  it('should migrate requireConfig=true to requireConfig=required', () => {
    expect(RequireConfigMigration).toMigrate(
      {
        requireConfig: true,
      },
      {
        requireConfig: 'required',
      }
    );
  });

  it('should migrate requireConfig=false to requireConfig=optional', () => {
    expect(RequireConfigMigration).toMigrate(
      {
        requireConfig: false,
      },
      {
        requireConfig: 'optional',
      }
    );
  });
});
