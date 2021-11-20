import { MigrationsService } from '../migrations-service';
import { EnabledManagersMigration } from './enabled-managers-migration';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('should replace yarn by nmp', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        enabledManagers: ['test1', 'yarn', 'test2'],
      },
      EnabledManagersMigration
    );

    expect(migratedConfig.enabledManagers).toEqual(['test1', 'npm', 'test2']);
  });
});
