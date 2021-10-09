import type { RenovateConfig } from '../types';
import { DeprecatePropertyMigration } from './base/deprecate-property-migration';
import { ReplacePropertyMigration } from './base/replace-property-migration';
import type { Migration } from './migration';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

export class MigrationsRunner {
  private static readonly migrations: ReadonlyArray<Migration> = [
    new DeprecatePropertyMigration('maintainYarnLock'),
    new DeprecatePropertyMigration('gitFs'),
    new ReplacePropertyMigration('exposeEnv', 'exposeAllEnv'),
    new ReplacePropertyMigration('separatePatchReleases', 'separateMinorPatch'),
    new RequiredStatusChecksMigration(),
  ];

  static runAllMigrations(originalConfig: RenovateConfig): RenovateConfig {
    let config = originalConfig;

    for (const migration of MigrationsRunner.migrations) {
      config = migration.run(config);
    }

    return config;
  }
}
