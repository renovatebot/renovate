import { expect } from '@jest/globals';
import type {
  DeprecatedRenovateConfig,
  Migration,
  MigrationConstructor,
} from '../lib/config/migrations/types';
import { MigrationsService } from './../lib/config/migrations/migrations-service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMigrate(
        originalConfig: DeprecatedRenovateConfig,
        expectedConfig: DeprecatedRenovateConfig,
        isMigrated?: boolean
      ): R;
    }
  }
}

expect.extend({
  toMigrate(
    CustomMigration: MigrationConstructor,
    originalConfig: DeprecatedRenovateConfig,
    expectedConfig: DeprecatedRenovateConfig,
    isMigrated = true
  ) {
    class CustomMigrationsService extends MigrationsService {
      protected static override getMigrations(
        original: DeprecatedRenovateConfig,
        migrated: DeprecatedRenovateConfig
      ): ReadonlyArray<Migration> {
        return [new CustomMigration(original, migrated)];
      }
    }

    const migratedConfig = CustomMigrationsService.run(originalConfig);

    if (
      MigrationsService.isMigrated(migratedConfig, originalConfig) !==
      isMigrated
    ) {
      return {
        message: (): string => `isMigrated should be ${isMigrated}`,
        pass: false,
      };
    }

    if (!this.equals(migratedConfig, expectedConfig)) {
      return {
        message: (): string => 'Migration failed',
        pass: false,
      };
    }

    return {
      message: (): string => 'Migration passed successfully',
      pass: true,
    };
  },
});
