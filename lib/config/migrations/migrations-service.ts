import type { RenovateConfig } from '../types';
import { AbstractMigration } from './base/abstract-migration';
import { RemovePropertyMigration } from './base/remove-property-migration';
import { RenamePropertyMigration } from './base/rename-property-migration';
import { BinarySourceMigration } from './custom/binary-source-migration';
import { EnabledManagersMigration } from './custom/enabled-managers-migration';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration';
import { PinVersionsMigration } from './custom/pin-versions-migration';
import { RebaseConflictedPrs } from './custom/rebase-conflicted-prs-migration';
import { RebaseStalePrsMigration } from './custom/rebase-stale-prs-migration';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration';
import { SemanticCommitsMigration } from './custom/semantic-commits-migration';
import { TrustLevelMigration } from './custom/trust-level-migration';
import { UpgradeInRangeMigration } from './custom/upgrade-in-range-migration';
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
    EnabledManagersMigration,
    GoModTidyMigration,
    IgnoreNodeModulesMigration,
    PinVersionsMigration,
    RebaseConflictedPrs,
    RebaseStalePrsMigration,
    RequiredStatusChecksMigration,
    SemanticCommitsMigration,
    TrustLevelMigration,
    UpgradeInRangeMigration,
  ];

  static run(originalConfig: RenovateConfig): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = MigrationsService.getMigrations(
      originalConfig,
      migratedConfig
    );

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;
      const migration = migrations.find((item) => item.propertyName === key);
      migration?.run();
    }

    return migratedConfig;
  }

  static runMigration(
    originalConfig: RenovateConfig,
    Migration: MigrationConstructor
  ): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migration = new Migration(originalConfig, migratedConfig);

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;
      if (key === migration.propertyName) {
        migration.run();
      }
    }

    return migratedConfig;
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
