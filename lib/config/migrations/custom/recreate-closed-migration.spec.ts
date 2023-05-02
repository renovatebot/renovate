import { RecreateClosedMigration } from './recreate-closed-migration';

describe('config/migrations/custom/recreate-closed-migration', () => {
  it('should migrate true', () => {
    expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: true as never,
      },
      {
        recreateWhen: 'always',
      }
    );
  });

  it('should migrate false', () => {
    expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: false as never,
      },
      {
        recreateWhen: 'auto',
      }
    );
  });
});
