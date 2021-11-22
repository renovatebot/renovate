import { MigrationsService } from '../migrations-service';
import { PackageRulesMigration } from './package-rules-migration';

describe('config/migrations/custom/package-rules-migration', () => {
  it('should migrate plain object to array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        packageRules: { test: 'test ' },
      } as any,
      PackageRulesMigration
    );

    expect(migratedConfig.packageRules).toEqual([{ test: 'test ' }]);
  });
});
