import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      gomodTidy: true,
      postUpdateOptions: ['test'],
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({
      postUpdateOptions: ['test', 'gomodTidy'],
    });
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      gomodTidy: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({
      postUpdateOptions: ['gomodTidy'],
    });
  });

  it('should only remove when false', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      gomodTidy: false,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({});
  });
});
