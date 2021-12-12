import { RenovateConfig } from './../../../test/util';
import { MigrationsService } from './migrations-service';
import { Migration, MigrationConstructor } from './types';

export function validateCustomMigration(
  CustomMigration: MigrationConstructor,
  originalConfig: RenovateConfig,
  expectedConfig: RenovateConfig
): void {
  class MigrationsServiceValidator extends MigrationsService {
    protected static override getMigrations(
      original: RenovateConfig,
      migrated: RenovateConfig
    ): ReadonlyArray<Migration> {
      return [new CustomMigration(original, migrated)];
    }
  }

  const migratedConfig = MigrationsServiceValidator.run(originalConfig);

  expect(
    MigrationsService.isMigrated(originalConfig, migratedConfig)
  ).toBeTrue();
  expect(migratedConfig).toEqual(expectedConfig);
}
