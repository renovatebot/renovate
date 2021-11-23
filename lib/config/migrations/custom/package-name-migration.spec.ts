import { MigrationsService } from '../migrations-service';
import { PackageNameMigration } from './package-name-migration';

describe('config/migrations/custom/package-name-migration', () => {
  it('should migrate value to array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        packageName: 'test',
      },
      PackageNameMigration
    );

    expect(migratedConfig).not.toHaveProperty('packageName');
    expect(migratedConfig.packageNames).toEqual(['test']);
  });
});
