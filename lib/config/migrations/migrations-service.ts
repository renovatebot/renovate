import { dequal } from 'dequal';
import type { RenovateConfig } from '../types';
import { RemovePropertyMigration } from './base/remove-property-migration';
import { RenamePropertyMigration } from './base/rename-property-migration';
import { AutomergeMajorMigration } from './custom/automerge-major-migration';
import { AutomergeTypeMigration } from './custom/automerge-type-migration';
import { BinarySourceMigration } from './custom/binary-source-migration';
import { CompatibilityMigration } from './custom/compatibility-migration';
import { ComposerIgnorePlatformReqsMigration } from './custom/composer-ignore-platform-reqs-migration';
import { EnabledManagersMigration } from './custom/enabled-managers-migration';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration';
import { HostRulesMigration } from './custom/host-rules-migration';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration';
import { PathRulesMigration } from './custom/path-rules-migration';
import { PinVersionsMigration } from './custom/pin-versions-migration';
import { RaiseDeprecationWarningsMigration } from './custom/raise-deprecation-warnings-migration';
import { RebaseConflictedPrs } from './custom/rebase-conflicted-prs-migration';
import { RebaseStalePrsMigration } from './custom/rebase-stale-prs-migration';
import { RenovateForkMigration } from './custom/renovate-fork-migration';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration';
import { SemanticCommitsMigration } from './custom/semantic-commits-migration';
import { SuppressNotificationsMigration } from './custom/suppress-notifications-migration';
import { TrustLevelMigration } from './custom/trust-level-migration';
import { UpgradeInRangeMigration } from './custom/upgrade-in-range-migration';
import { VersionStrategyMigration } from './custom/version-strategy-migration';
import type { Migration, MigrationConstructor } from './types';

export class MigrationsService {
  static readonly removedProperties: ReadonlySet<string> = new Set([
    'deepExtract',
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
    ['endpoints', 'hostRules'],
    ['excludedPackageNames', 'excludePackageNames'],
    ['exposeEnv', 'exposeAllEnv'],
    ['managerBranchPrefix', 'additionalBranchPrefix'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['versionScheme', 'versioning'],
    ['lookupNameTemplate', 'packageNameTemplate'],
  ]);

  static readonly customMigrations: ReadonlyArray<MigrationConstructor> = [
    AutomergeMajorMigration,
    AutomergeTypeMigration,
    BinarySourceMigration,
    CompatibilityMigration,
    ComposerIgnorePlatformReqsMigration,
    EnabledManagersMigration,
    GoModTidyMigration,
    HostRulesMigration,
    IgnoreNodeModulesMigration,
    PathRulesMigration,
    PinVersionsMigration,
    RaiseDeprecationWarningsMigration,
    RebaseConflictedPrs,
    RebaseStalePrsMigration,
    RenovateForkMigration,
    RequiredStatusChecksMigration,
    SemanticCommitsMigration,
    SuppressNotificationsMigration,
    TrustLevelMigration,
    UpgradeInRangeMigration,
    VersionStrategyMigration,
  ];

  static run(originalConfig: RenovateConfig): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = this.getMigrations(originalConfig, migratedConfig);

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;
      const migration = migrations.find((item) => item.propertyName === key);

      if (migration) {
        migration.run(value);

        if (migration.deprecated) {
          delete migratedConfig[key];
        }
      }
    }

    return migratedConfig;
  }

  static isMigrated(
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): boolean {
    return !dequal(originalConfig, migratedConfig);
  }

  protected static getMigrations(
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): ReadonlyArray<Migration> {
    const migrations: Migration[] = [];

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

    for (const CustomMigration of this.customMigrations) {
      migrations.push(new CustomMigration(originalConfig, migratedConfig));
    }

    return migrations;
  }
}
