import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('should replace yarn by nmp', () => {
    const migratedConfig = MigrationsService.run({
      enabledManagers: ['test1', 'yarn', 'test2'],
    });

    expect(migratedConfig.enabledManagers).toEqual(['test1', 'npm', 'test2']);
  });
});
