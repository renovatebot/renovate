import { MigrationsService } from '../migrations-service';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        requiredStatusChecks: null,
      },
      RequiredStatusChecksMigration
    );

    expect(migratedConfig).not.toHaveProperty('requiredStatusChecks');
    expect(migratedConfig.ignoreTests).toBeTrue();
  });
});
