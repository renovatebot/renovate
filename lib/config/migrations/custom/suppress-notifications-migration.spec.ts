import { SuppressNotificationsMigration } from './suppress-notifications-migration';

describe('config/migrations/custom/suppress-notifications-migration', () => {
  it('should remomve prEditNotification from array', () => {
    expect(SuppressNotificationsMigration).toMigrate(
      {
        suppressNotifications: ['test', 'prEditNotification'],
      },
      {
        suppressNotifications: ['test'],
      },
    );
  });

  it('should not migrate array without prEditNotification', () => {
    expect(SuppressNotificationsMigration).toMigrate(
      {
        suppressNotifications: ['test'],
      },
      {
        suppressNotifications: ['test'],
      },
      false,
    );
  });

  it('should not migrate empty array', () => {
    expect(SuppressNotificationsMigration).toMigrate(
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
