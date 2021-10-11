import type { Migration } from '../../types/migrations';
import type { RenovateConfig } from '../types';
import { DeprecatePropertyMigration } from './base/deprecate-property-migration';
import { ReplacePropertyMigration } from './base/replace-property-migration';
import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

export class MigrationsService {
  static readonly deprecatedProperties: ReadonlySet<string> = new Set([
    'gitFs',
    'groupBranchName',
    'groupCommitMessage',
    'groupPrBody',
    'groupPrTitle',
    'lazyGrouping',
    'maintainYarnLock',
    'statusCheckVerify',
    'supportPolicy',
    'yarnCacheFolder',
    'yarnMaintenanceBranchName',
    'yarnMaintenanceCommitMessage',
    'yarnMaintenancePrBody',
    'yarnMaintenancePrTitle',
  ]);

  static readonly renamedProperties: ReadonlyMap<string, string> = new Map([
    ['exposeEnv', 'exposeAllEnv'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
  ]);

  private static readonly customMigrations: ReadonlyArray<Migration> = [
    new RequiredStatusChecksMigration(),
    new IgnoreNodeModulesMigration(),
  ];

  static run(originalConfig: RenovateConfig): RenovateConfig {
    const migrations: Migration[] = [...MigrationsService.customMigrations];
    let config = originalConfig;

    for (const property of MigrationsService.deprecatedProperties) {
      migrations.push(new DeprecatePropertyMigration(property));
    }

    for (const [
      oldPropertyName,
      newPropertyName,
    ] of MigrationsService.renamedProperties.entries()) {
      migrations.push(
        new ReplacePropertyMigration(oldPropertyName, newPropertyName)
      );
    }

    for (const migration of migrations) {
      config = migration.run(config);
    }

    return config;
  }
}
