import { MigrationsService } from '../migrations-service';
import { PackagePatternMigration } from './package-pattern-migration';

describe('config/migrations/custom/package-pattern-migration', () => {
  it('should migrate value to array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        packagePattern: 'test',
      },
      PackagePatternMigration
    );

    expect(migratedConfig.packagePatterns).toEqual(['test']);
  });
});
