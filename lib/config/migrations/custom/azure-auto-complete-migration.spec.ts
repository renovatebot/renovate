import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/azure-auto-complete-migration', () => {
  it('should migrate true', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      azureAutoComplete: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ platformAutomerge: true });
  });

  it('should migrate false', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      azureAutoComplete: false,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ platformAutomerge: false });
  });
});
