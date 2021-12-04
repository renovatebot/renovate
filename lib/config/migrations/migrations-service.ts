import { dequal } from 'dequal';
import type { MigratedConfig, RenovateConfig } from '../types';
import { AbstractMigration } from './base/abstract-migration';
import { RemovePropertyMigration } from './base/remove-property-migration';
import { RenamePropertyMigration } from './base/rename-property-migration';
import { BinarySourceMigration } from './custom/binary-source-migration';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration';
import { TrustLevelMigration } from './custom/trust-level-migration';
import type { MigrationConstructor } from './types';

export class MigrationsService {
  static readonly removedProperties: ReadonlySet<string> = new Set([
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
    ['excludedPackageNames', 'excludePackageNames'],
    ['versionScheme', 'versioning'],
  ]);

  static readonly customMigrations: ReadonlyArray<MigrationConstructor> = [
    BinarySourceMigration,
    GoModTidyMigration,
    IgnoreNodeModulesMigration,
    RequiredStatusChecksMigration,
    TrustLevelMigration,
  ];

  static run(originalConfig: RenovateConfig): MigratedConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = MigrationsService.getMigrations(
      originalConfig,
      migratedConfig
    );

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;
      const migration = migrations.find((item) => item.propertyName === key);
      migration?.run(value);
    }

    return {
      isMigrated: !dequal(originalConfig, migratedConfig),
      migratedConfig,
    };
  }

  private static getMigrations(
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): AbstractMigration[] {
    const migrations: AbstractMigration[] = [];

    for (const propertyName of MigrationsService.removedProperties) {
      migrations.push(
        new RemovePropertyMigration(
          propertyName,
          originalConfig,
          migratedConfig
        )
      );
    }

    for (const [
      oldPropertyName,
      newPropertyName,
    ] of MigrationsService.renamedProperties.entries()) {
      migrations.push(
        new RenamePropertyMigration(
          oldPropertyName,
          newPropertyName,
          originalConfig,
          migratedConfig
        )
      );
    }

    for (const Migration of this.customMigrations) {
      migrations.push(new Migration(originalConfig, migratedConfig));
    }

    return migrations;
  }
}
