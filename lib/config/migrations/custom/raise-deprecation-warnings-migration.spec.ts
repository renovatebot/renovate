import { MigrationsService } from '../migrations-service';
import { RaiseDeprecationWarningsMigration } from './raise-deprecation-warnings-migration';

describe('config/migrations/custom/raise-deprecation-warnings-migration', () => {
  it('should migrate false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        raiseDeprecationWarnings: false,
      },
      RaiseDeprecationWarningsMigration
    );

    expect(migratedConfig.suppressNotifications).toEqual([
      'deprecationWarningIssues',
    ]);
  });

  it('should migrate false and concat with existing value', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        raiseDeprecationWarnings: false,
        suppressNotifications: ['test'],
      },
      RaiseDeprecationWarningsMigration
    );

    expect(migratedConfig.suppressNotifications).toEqual([
      'test',
      'deprecationWarningIssues',
    ]);
  });
});
