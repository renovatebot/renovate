import { MigrationsService } from '../migrations-service';
import { SuppressNotificationsMigration } from './suppress-notifications-migration';

describe('config/migrations/custom/suppress-notifications-migration', () => {
  it('should remomve prEditNotification from array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        suppressNotifications: ['test', 'prEditNotification'],
      },
      SuppressNotificationsMigration
    );

    expect(migratedConfig.suppressNotifications).toEqual(['test']);
  });
});
