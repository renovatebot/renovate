import { RecreateClosedMigration } from './recreate-closed-migration';

describe('config/migrations/custom/recreate-closed-migration', () => {
  it('should migrate true', () => {
    expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: true,
      },
      {
        recreateWhen: 'always',
      },
    );
  });

  it('should migrate false', () => {
    expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: false,
      },
      {
        recreateWhen: 'auto',
      },
    );
  });
});
