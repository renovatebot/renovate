import { isRegExp } from '@sindresorhus/is';
import { dequal } from 'dequal';
import type { RenovateConfig } from '../types.ts';
import { RemovePropertyMigration } from './base/remove-property-migration.ts';
import { RenamePropertyMigration } from './base/rename-property-migration.ts';
import { AutomergeMajorMigration } from './custom/automerge-major-migration.ts';
import { AutomergeMigration } from './custom/automerge-migration.ts';
import { AutomergeMinorMigration } from './custom/automerge-minor-migration.ts';
import { AutomergePatchMigration } from './custom/automerge-patch-migration.ts';
import { AutomergeTypeMigration } from './custom/automerge-type-migration.ts';
import { AzureGitLabAutomergeMigration } from './custom/azure-gitlab-automerge-migration.ts';
import { BaseBranchMigration } from './custom/base-branch-migration.ts';
import { BinarySourceMigration } from './custom/binary-source-migration.ts';
import { BranchNameMigration } from './custom/branch-name-migration.ts';
import { BranchPrefixMigration } from './custom/branch-prefix-migration.ts';
import { CompatibilityMigration } from './custom/compatibility-migration.ts';
import { ComposerIgnorePlatformReqsMigration } from './custom/composer-ignore-platform-reqs-migration.ts';
import { CustomManagersMigration } from './custom/custom-managers-migration.ts';
import { DatasourceMigration } from './custom/datasource-migration.ts';
import { DepTypesMigration } from './custom/dep-types-migration.ts';
import { DryRunMigration } from './custom/dry-run-migration.ts';
import { EnabledManagersMigration } from './custom/enabled-managers-migration.ts';
import { ExtendsMigration } from './custom/extends-migration.ts';
import { FetchReleaseNotesMigration } from './custom/fetch-release-notes-migration.ts';
import { FileMatchMigration } from './custom/file-match-migration.ts';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration.ts';
import { HostRulesMigration } from './custom/host-rules-migration.ts';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration.ts';
import { IgnoreNpmrcFileMigration } from './custom/ignore-npmrc-file-migration.ts';
import { IncludeForksMigration } from './custom/include-forks-migration.ts';
import { MatchDatasourcesMigration } from './custom/match-datasources-migration.ts';
import { MatchManagersMigration } from './custom/match-managers-migration.ts';
import { MatchStringsMigration } from './custom/match-strings-migration.ts';
import { NodeMigration } from './custom/node-migration.ts';
import { PackageFilesMigration } from './custom/package-files-migration.ts';
import { PackageNameMigration } from './custom/package-name-migration.ts';
import { PackagePatternMigration } from './custom/package-pattern-migration.ts';
import { PackageRulesMigration } from './custom/package-rules-migration.ts';
import { PackagesMigration } from './custom/packages-migration.ts';
import { PathRulesMigration } from './custom/path-rules-migration.ts';
import { PinVersionsMigration } from './custom/pin-versions-migration.ts';
import { PlatformCommitMigration } from './custom/platform-commit-migration.ts';
import { PostUpdateOptionsMigration } from './custom/post-update-options-migration.ts';
import { RebaseConflictedPrs } from './custom/rebase-conflicted-prs-migration.ts';
import { RebaseStalePrsMigration } from './custom/rebase-stale-prs-migration.ts';
import { RecreateClosedMigration } from './custom/recreate-closed-migration.ts';
import { RenovateForkMigration } from './custom/renovate-fork-migration.ts';
import { RequireConfigMigration } from './custom/require-config-migration.ts';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration.ts';
import { ScheduleMigration } from './custom/schedule-migration.ts';
import { SemanticCommitsMigration } from './custom/semantic-commits-migration.ts';
import { SemanticPrefixMigration } from './custom/semantic-prefix-migration.ts';
import { SeparateMajorReleasesMigration } from './custom/separate-major-release-migration.ts';
import { SeparateMultipleMajorMigration } from './custom/separate-multiple-major-migration.ts';
import { StabilityDaysMigration } from './custom/stability-days-migration.ts';
import { SuppressNotificationsMigration } from './custom/suppress-notifications-migration.ts';
import { TrustLevelMigration } from './custom/trust-level-migration.ts';
import { UnpublishSafeMigration } from './custom/unpublish-safe-migration.ts';
import { UpdateLockFilesMigration } from './custom/update-lock-files-migration.ts';
import { UpgradeInRangeMigration } from './custom/upgrade-in-range-migration.ts';
import { VersionStrategyMigration } from './custom/version-strategy-migration.ts';
import type {
  MigratableConfig,
  Migration,
  MigrationConstructor,
} from './types.ts';

export class MigrationsService {
  static readonly removedProperties: ReadonlySet<string> = new Set([
    'allowCommandTemplating',
    'allowPostUpgradeCommandTemplating',
    'deepExtract',
    'gitFs',
    'groupBranchName',
    'groupCommitMessage',
    'groupPrBody',
    'groupPrTitle',
    'lazyGrouping',
    'maintainYarnLock',
    'raiseDeprecationWarnings',
    'statusCheckVerify',
    'supportPolicy',
    'transitiveRemediation',
    'yarnCacheFolder',
    'yarnMaintenanceBranchName',
    'yarnMaintenanceCommitMessage',
    'yarnMaintenancePrBody',
    'yarnMaintenancePrTitle',
  ]);

  static readonly renamedProperties: ReadonlyMap<string, string> = new Map([
    ['adoptium-java', 'java-version'],
    ['allowedPostUpgradeCommands', 'allowedCommands'],
    ['azureAutoApprove', 'autoApprove'],
    ['customChangelogUrl', 'changelogUrl'],
    ['endpoints', 'hostRules'],
    ['excludedPackageNames', 'excludePackageNames'],
    ['exposeEnv', 'exposeAllEnv'],
    ['keepalive', 'keepAlive'],
    ['managerBranchPrefix', 'additionalBranchPrefix'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['versionScheme', 'versioning'],
    ['lookupNameTemplate', 'packageNameTemplate'],
    ['aliases', 'registryAliases'],
    ['masterIssue', 'dependencyDashboard'],
    ['masterIssueApproval', 'dependencyDashboardApproval'],
    ['masterIssueAutoclose', 'dependencyDashboardAutoclose'],
    ['masterIssueHeader', 'dependencyDashboardHeader'],
    ['masterIssueFooter', 'dependencyDashboardFooter'],
    ['masterIssueTitle', 'dependencyDashboardTitle'],
    ['masterIssueLabels', 'dependencyDashboardLabels'],
    ['regexManagers', 'customManagers'],
    ['baseBranches', 'baseBranchPatterns'],
  ]);

  static readonly customMigrations: readonly MigrationConstructor[] = [
    AutomergeMajorMigration,
    AutomergeMigration,
    AutomergeMinorMigration,
    AutomergePatchMigration,
    AutomergeTypeMigration,
    AzureGitLabAutomergeMigration,
    BaseBranchMigration,
    BinarySourceMigration,
    BranchNameMigration,
    BranchPrefixMigration,
    CompatibilityMigration,
    ComposerIgnorePlatformReqsMigration,
    EnabledManagersMigration,
    ExtendsMigration,
    GoModTidyMigration,
    HostRulesMigration,
    IgnoreNodeModulesMigration,
    IgnoreNpmrcFileMigration,
    IncludeForksMigration,
    MatchStringsMigration,
    PackageNameMigration,
    PackagePatternMigration,
    PackagesMigration,
    PathRulesMigration,
    PinVersionsMigration,
    PostUpdateOptionsMigration,
    RebaseConflictedPrs,
    RebaseStalePrsMigration,
    RenovateForkMigration,
    RequiredStatusChecksMigration,
    ScheduleMigration,
    SemanticCommitsMigration,
    SeparateMajorReleasesMigration,
    SeparateMultipleMajorMigration,
    SuppressNotificationsMigration,
    TrustLevelMigration,
    UnpublishSafeMigration,
    UpgradeInRangeMigration,
    VersionStrategyMigration,
    DryRunMigration,
    RequireConfigMigration,
    PackageFilesMigration,
    DepTypesMigration,
    PackageRulesMigration,
    NodeMigration,
    SemanticPrefixMigration,
    MatchDatasourcesMigration,
    DatasourceMigration,
    RecreateClosedMigration,
    StabilityDaysMigration,
    FetchReleaseNotesMigration,
    MatchManagersMigration,
    CustomManagersMigration,
    PlatformCommitMigration,
    FileMatchMigration,
    UpdateLockFilesMigration,
  ];

  static run(
    originalConfig: MigratableConfig,
    parentKey?: string,
  ): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = this.getMigrations(originalConfig, migratedConfig);

    for (const [key, value] of Object.entries(originalConfig) as [
      keyof RenovateConfig,
      unknown,
    ][]) {
      // @ts-expect-error -- can't be narrowed
      migratedConfig[key] ??= value;
      const migration = MigrationsService.getMigration(migrations, key);

      if (migration) {
        migration.run(value, key, parentKey);

        if (migration.deprecated) {
          delete migratedConfig[key];
        }
      }
    }

    return migratedConfig;
  }

  static isMigrated(
    originalConfig: MigratableConfig,
    migratedConfig: RenovateConfig,
  ): boolean {
    return !dequal(originalConfig, migratedConfig);
  }

  public static getMigrations(
    originalConfig: MigratableConfig,
    migratedConfig: RenovateConfig,
  ): readonly Migration[] {
    const migrations: Migration[] = [];

    for (const propertyName of MigrationsService.removedProperties) {
      migrations.push(
        new RemovePropertyMigration(
          propertyName,
          originalConfig,
          migratedConfig,
        ),
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
          migratedConfig,
        ),
      );
    }

    for (const CustomMigration of this.customMigrations) {
      migrations.push(new CustomMigration(originalConfig, migratedConfig));
    }

    return migrations;
  }

  private static getMigration(
    migrations: readonly Migration[],
    key: string,
  ): Migration | undefined {
    return migrations.find((migration) => {
      if (isRegExp(migration.propertyName)) {
        return migration.propertyName.test(key);
      }

      return migration.propertyName === key;
    });
  }
}
