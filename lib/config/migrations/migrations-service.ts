import type { Migration } from '../../types/migrations';
import type { RenovateConfig } from '../types';
import { DeprecatePropertyMigration } from './base/deprecate-property-migration';
import { ReplacePropertyMigration } from './base/replace-property-migration';
import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

export class MigrationsService {
  private static readonly migrations: ReadonlyArray<Migration> = [
    new DeprecatePropertyMigration('maintainYarnLock'),
    new DeprecatePropertyMigration('gitFs'),
    new ReplacePropertyMigration('exposeEnv', 'exposeAllEnv'),
    new ReplacePropertyMigration('separatePatchReleases', 'separateMinorPatch'),
    new RequiredStatusChecksMigration(),
    new IgnoreNodeModulesMigration(),
  ];

  static run(originalConfig: RenovateConfig): RenovateConfig {
    let config = originalConfig;

    for (const migration of MigrationsService.migrations) {
      config = migration.run(config);
    }

    return config;
  }
}
