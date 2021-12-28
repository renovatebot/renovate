import { RenovateConfig } from '../../../test/util';
import { MigrationsService } from './migrations-service';
import { Migration, MigrationConstructor } from './types';

export function getCustomMigrationsService(
  CustomMigration: MigrationConstructor
): typeof MigrationsService {
  return class CustomMigrationsService extends MigrationsService {
    protected static override getMigrations(
      original: RenovateConfig,
      migrated: RenovateConfig
    ): ReadonlyArray<Migration> {
      return [new CustomMigration(original, migrated)];
    }
  };
}

export function getCustomMigrationValidator(
  CustomMigration: MigrationConstructor
): (
  originalConfig: RenovateConfig,
  expectedConfig: RenovateConfig,
  isMigrated?: boolean
) => void {
  const CustomMigrationsService = getCustomMigrationsService(CustomMigration);

  return (
    originalConfig: RenovateConfig,
    expectedConfig: RenovateConfig,
    isMigrated = true
  ): void => {
    const migratedConfig = CustomMigrationsService.run(originalConfig);

    expect(MigrationsService.isMigrated(originalConfig, migratedConfig)).toBe(
      isMigrated
    );
    expect(migratedConfig).toEqual(expectedConfig);
  };
}
