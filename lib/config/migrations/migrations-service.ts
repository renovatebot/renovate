import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import type { MigratedConfig, RenovateConfig } from '../types';
import { AbstractMigration } from './base/abstract-migration';
import { MigrationByValueType } from './base/migration-by-value-type';
import { RemovePropertyMigration } from './base/remove-property-migration';
import { RenamePropertyMigration } from './base/rename-property-migration';
import { AutomergeMajorMigration } from './custom/automerge-major-migration';
import { AutomergeMigration } from './custom/automerge-migration';
import { AutomergeMinorMigration } from './custom/automerge-minor-migration';
import { AutomergePatchMigration } from './custom/automerge-patch-migration';
import { AutomergeTypeMigration } from './custom/automerge-type-migration';
import { AzureAutoCompleteMigration } from './custom/azure-auto-complete-migration';
import { BaseBranchMigration } from './custom/base-branch-migration';
import { BinarySourceMigration } from './custom/binary-source-migration';
import { BranchNameMigration } from './custom/branch-name-migration';
import { BranchPrefixMigration } from './custom/branch-prefix-migration';
import { CompatibilityMigration } from './custom/compatibility-migration';
import { ComposerIgnorePlatformReqsMigration } from './custom/composer-ignore-platform-reqs-migration';
import { EnabledManagersMigration } from './custom/enabled-managers-migration';
import { ExtendsMigration } from './custom/extends-migration';
import { GitLabAutomergeMigration } from './custom/gitlab-automerge-migration';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration';
import { GradleLiteMigration } from './custom/gradle-lite-migration';
import { HostRulesMigration } from './custom/host-rules-migration';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration';
import { IgnoreNpmrcFileMigration } from './custom/ignore-npmrc-file-migration';
import { MasterIssueMigration } from './custom/master-issue-migration';
import { MatchManagersMigration } from './custom/match-managers-migration';
import { PackageNameMigration } from './custom/package-name-migration';
import { PackagePatternMigration } from './custom/package-pattern-migration';
import { PackageRulesMigration } from './custom/package-rules-migration';
import { PackagesMigration } from './custom/packages-migration';
import { PathRulesMigration } from './custom/path-rules-migration';
import { PinVersionsMigration } from './custom/pin-versions-migration';
import { RaiseDeprecationWarningsMigration } from './custom/raise-deprecation-warnings-migration';
import { RebaseConflictedPrs } from './custom/rebase-conflicted-prs-migration';
import { RebaseStalePrsMigration } from './custom/rebase-stale-prs-migration';
import { RenovateForkMigration } from './custom/renovate-fork-migration';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration';
import { ScheduleMigration } from './custom/schedule-migration';
import { SemanticCommitsMigration } from './custom/semantic-commits-migration';
import { SemanticPrefixMigration } from './custom/semantic-prefix-migration';
import { SeparateMajorReleasesMigration } from './custom/separate-major-release-migration';
import { SuppressNotificationsMigration } from './custom/suppress-notifications-migration';
import { TrustLevelMigration } from './custom/trust-level-migration';
import { UnpublishSafeMigration } from './custom/unpublish-safe-migration';
import { UpgradeInRangeMigration } from './custom/upgrade-in-range-migration';
import { VersionStrategyMigration } from './custom/version-strategy-migration';
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
    ['endpoints', 'hostRules'],
    ['excludedPackageNames', 'excludePackageNames'],
    ['exposeEnv', 'exposeAllEnv'],
    ['managerBranchPrefix', 'additionalBranchPrefix'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['versionScheme', 'versioning'],
  ]);

  static readonly customMigrations: ReadonlyArray<MigrationConstructor> = [
    AutomergeMajorMigration,
    AutomergeMigration,
    AutomergeMinorMigration,
    AutomergePatchMigration,
    AutomergeTypeMigration,
    AzureAutoCompleteMigration,
    BaseBranchMigration,
    BinarySourceMigration,
    BranchNameMigration,
    BranchPrefixMigration,
    CompatibilityMigration,
    ComposerIgnorePlatformReqsMigration,
    EnabledManagersMigration,
    ExtendsMigration,
    GitLabAutomergeMigration,
    GoModTidyMigration,
    GradleLiteMigration,
    HostRulesMigration,
    IgnoreNodeModulesMigration,
    IgnoreNpmrcFileMigration,
    MasterIssueMigration,
    MatchManagersMigration,
    PackageNameMigration,
    PackagePatternMigration,
    PackageRulesMigration,
    PackagesMigration,
    PathRulesMigration,
    PinVersionsMigration,
    RaiseDeprecationWarningsMigration,
    RebaseConflictedPrs,
    RebaseStalePrsMigration,
    RenovateForkMigration,
    RequiredStatusChecksMigration,
    ScheduleMigration,
    SemanticCommitsMigration,
    SemanticPrefixMigration,
    SeparateMajorReleasesMigration,
    SuppressNotificationsMigration,
    TrustLevelMigration,
    UnpublishSafeMigration,
    UpgradeInRangeMigration,
    VersionStrategyMigration,
  ];

  static run(originalConfig: RenovateConfig): MigratedConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = MigrationsService.getMigrations(
      originalConfig,
      migratedConfig
    );
    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;

      const migrationByPropertyName = migrations.find((item) =>
        MigrationsService.isMigrationForProperty(item, key)
      );

      if (migrationByPropertyName) {
        migrationByPropertyName.run(value, key);
      } else {
        const migrationByValueType = new MigrationByValueType(
          key,
          originalConfig,
          migratedConfig
        );
        migrationByValueType.run(value);
      }
    }

    return {
      isMigrated: !dequal(originalConfig, migratedConfig),
      migratedConfig,
    };
  }

  static runMigration(
    originalConfig: RenovateConfig,
    Migration: MigrationConstructor
  ): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migration = new Migration(originalConfig, migratedConfig);

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;

      if (MigrationsService.isMigrationForProperty(migration, key)) {
        migration.run(value, key);
      }
    }

    return migratedConfig;
  }

  private static isMigrationForProperty(
    migration: AbstractMigration,
    key: string
  ): boolean {
    if (is.regExp(migration.propertyName)) {
      return migration.propertyName.test(key);
    }

    return migration.propertyName === key;
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
