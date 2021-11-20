import { MigrationsService } from '../migrations-service';
import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        gomodTidy: true,
        postUpdateOptions: ['test'],
      },
      GoModTidyMigration
    );

    expect(migratedConfig).not.toHaveProperty('gomodTidy');
    expect(migratedConfig.postUpdateOptions).toEqual(['test', 'gomodTidy']);
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        gomodTidy: true,
      },
      GoModTidyMigration
    );

    expect(migratedConfig).not.toHaveProperty('gomodTidy');
    expect(migratedConfig.postUpdateOptions).toEqual(['gomodTidy']);
  });

  it('should only remove when false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        gomodTidy: false,
      },
      GoModTidyMigration
    );

    expect(migratedConfig).not.toHaveProperty('gomodTidy');
    expect(migratedConfig).not.toHaveProperty('postUpdateOptions');
  });
});
