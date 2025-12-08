import { SuppressNotificationsMigration } from './suppress-notifications-migration';

describe('config/migrations/custom/suppress-notifications-migration', () => {
  it('should remomve prEditNotification from array', async () => {
    await expect(SuppressNotificationsMigration).toMigrate(
      {
        suppressNotifications: ['test', 'prEditNotification'],
      },
      {
        suppressNotifications: ['test'],
      },
    );
  });

  it('should not migrate array without prEditNotification', async () => {
    await expect(SuppressNotificationsMigration).toMigrate(
      {
        suppressNotifications: ['test'],
      },
      {
        suppressNotifications: ['test'],
      },
      false,
    );
  });

  it('should not migrate empty array', async () => {
    await expect(SuppressNotificationsMigration).toMigrate(
      {
        suppressNotifications: [],
      },
      {
        suppressNotifications: [],
      },
      false,
    );
  });
});
