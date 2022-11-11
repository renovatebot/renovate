import { expect } from '@jest/globals';
import type {
  Migration,
  MigrationConstructor,
} from '../lib/config/migrations/types';
import type { RenovateConfig } from '../lib/config/types';
import { MigrationsService } from './../lib/config/migrations/migrations-service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMigrate(
        originalConfig: RenovateConfig,
        expectedConfig: RenovateConfig,
        isMigrated?: boolean
      ): R;
    }
  }
}

expect.extend({
  toMigrate(
    CustomMigration: MigrationConstructor,
    originalConfig: RenovateConfig,
    expectedConfig: RenovateConfig,
    // not inferrable type https://github.com/typescript-eslint/typescript-eslint/issues/5199
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    isMigrated: boolean = true
  ) {
    class CustomMigrationsService extends MigrationsService {
      protected static override getMigrations(
        original: RenovateConfig,
        migrated: RenovateConfig
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
        message: (): string =>
          `Migration failed\n\nReceived config:\n${JSON.stringify(
            migratedConfig
          )}\n\nExpected config:\n${JSON.stringify(expectedConfig)}`,
        pass: false,
      };
    }

    return {
      message: (): string => 'Migration passed successfully',
      pass: true,
    };
  },
});
