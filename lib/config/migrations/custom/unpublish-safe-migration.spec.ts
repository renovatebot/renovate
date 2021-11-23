import { MigrationsService } from '../migrations-service';
import { UnpublishSafeMigration } from './unpublish-safe-migration';

describe('config/migrations/custom/unpublish-safe-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        unpublishSafe: true,
      },
      UnpublishSafeMigration
    );

    expect(migratedConfig).not.toHaveProperty('unpublishSafe');
    expect(migratedConfig.extends).toEqual(['npm:unpublishSafe']);
  });

  it('should migrate true and handle extends field', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        extends: 'test',
        unpublishSafe: true,
      } as any,
      UnpublishSafeMigration
    );

    expect(migratedConfig).not.toHaveProperty('unpublishSafe');
    expect(migratedConfig.extends).toEqual(['test', 'npm:unpublishSafe']);
  });
});
