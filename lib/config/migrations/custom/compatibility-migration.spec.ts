import { MigrationsService } from '../migrations-service';
import { CompatibilityMigration } from './compatibility-migration';

describe('config/migrations/custom/compatibility-migration', () => {
  it('should migrate object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        compatibility: {
          test: 'test',
        },
      },
      CompatibilityMigration
    );

    expect(migratedConfig).not.toHaveProperty('compatibility');
    expect(migratedConfig.constraints).toEqual({
      test: 'test',
    });
  });
});
