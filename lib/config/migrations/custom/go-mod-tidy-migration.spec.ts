import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    const migratedConfig = MigrationsService.run({
      gomodTidy: true,
      postUpdateOptions: ['test'],
    });

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('test');
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    const migratedConfig = MigrationsService.run({
      gomodTidy: true,
    });

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should only remove when false', () => {
    const migratedConfig = MigrationsService.run({
      gomodTidy: false,
    });

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toBeUndefined();
  });
});
