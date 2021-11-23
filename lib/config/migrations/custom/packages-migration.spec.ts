import { MigrationsService } from '../migrations-service';
import { PackagesMigration } from './packages-migration';

describe('config/migrations/custom/packages-migration', () => {
  it('should concat with package rules', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        packages: ['one'],
        packageRules: ['two'],
      } as any,
      PackagesMigration
    );

    expect(migratedConfig).not.toHaveProperty('packages');
    expect(migratedConfig.packageRules).toEqual(['two', 'one']);
  });
});
