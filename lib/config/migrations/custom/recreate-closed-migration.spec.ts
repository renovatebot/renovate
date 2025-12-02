import { RecreateClosedMigration } from './recreate-closed-migration';

describe('config/migrations/custom/recreate-closed-migration', () => {
  it('should migrate true', async () => {
    await expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: true,
      },
      {
        recreateWhen: 'always',
      },
    );
  });

  it('should migrate false', async () => {
    await expect(RecreateClosedMigration).toMigrate(
      {
        recreateClosed: false,
      },
      {
        recreateWhen: 'auto',
      },
    );
  });
});
