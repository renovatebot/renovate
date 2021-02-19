import { LogLevel } from 'bunyan';
import { Range } from 'semver';
import { HostRule } from '../types';

export type RenovateConfigStage =
  | 'global'
  | 'repository'
  | 'package'
  | 'branch'
  | 'pr';

export type RepositoryCacheConfig = 'disabled' | 'enabled' | 'reset';

export interface GroupConfig extends Record<string, unknown> {
  branchName?: string;
  branchTopic?: string;
}

// TODO: Proper typings
export interface RenovateSharedConfig {
  $schema?: string;
  automerge?: boolean;
  branchPrefix?: string;
  branchName?: string;
  manager?: string;
  commitMessage?: string;
  commitMessagePrefix?: string;
  draftPR?: boolean;
  enabled?: boolean;
  enabledManagers?: string[];
  extends?: string[];
  fileMatch?: string[];
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  includePaths?: string[];
  ignoreDeps?: string[];
  ignorePaths?: string[];
  labels?: string[];
  addLabels?: string[];
  dependencyDashboardApproval?: boolean;
  hashedBranchLength?: number;
  npmrc?: string;
  platform?: string;
  postUpgradeTasks?: PostUpgradeTasks;
  prBodyColumns?: string[];
  prBodyDefinitions?: Record<string, string>;
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
  productLinks?: Record<string, string>;
  prPriority?: number;
  rebaseLabel?: string;
  rebaseWhen?: string;
  recreateClosed?: boolean;
  repository?: string;
  repositoryCache?: RepositoryCacheConfig;
  requiredStatusChecks?: string[];
  schedule?: string[];
  semanticCommits?: 'auto' | 'enabled' | 'disabled';
  semanticCommitScope?: string;
  semanticCommitType?: string;
  suppressNotifications?: string[];
  timezone?: string;
  unicodeEmoji?: boolean;
}

// Config options used only within the global worker
// The below should contain config options where stage=global
export interface GlobalOnlyConfig {
  autodiscover?: boolean;
  autodiscoverFilter?: string;
  baseDir?: string;
  forceCli?: boolean;
  gitPrivateKey?: string;
  logFile?: string;
  logFileLevel?: LogLevel;
  logLevel?: LogLevel;
  prCommitsPerRunLimit?: number;
  privateKeyPath?: string;
  redisUrl?: string;
  repositories?: RenovateRepository[];
}

// Config options used within the repository worker, but not user configurable
// The below should contain config options where admin=true
export interface RepoAdminConfig {
  allowPostUpgradeCommandTemplating?: boolean;
  allowedPostUpgradeCommands?: string[];
  customEnvVariables?: Record<string, string>;
  dockerImagePrefix?: string;
  dockerUser?: string;
  dryRun?: boolean;
  privateKey?: string | Buffer;
  trustLevel?: 'low' | 'high';
}

export interface LegacyAdminConfig {
  cacheDir?: string;

  endpoint?: string;

  localDir?: string;

  logContext?: string;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingCommitMessage?: string;
  onboardingPrTitle?: string;
  onboardingConfig?: RenovateSharedConfig;
  onboardingConfigFileName?: string;

  platform?: string;
  requireConfig?: boolean;
}

export type PostUpgradeTasks = {
  commands?: string[];
  fileFilters?: string[];
};

type UpdateConfig<
  T extends RenovateSharedConfig = RenovateSharedConfig
> = Partial<Record<UpdateType, T>>;

export type RenovateRepository =
  | string
  | {
      repository: string;
    };

export interface CustomManager {
  fileMatch: string[];
  matchStrings: string[];
  matchStringsStrategy?: string;
  depNameTemplate?: string;
  datasourceTemplate?: string;
  lookupNameTemplate?: string;
  versioningTemplate?: string;
}

// TODO: Proper typings
export interface RenovateConfig
  extends LegacyAdminConfig,
    RenovateSharedConfig,
    UpdateConfig<PackageRule>,
    AssigneesAndReviewersConfig,
    Record<string, unknown> {
  depName?: string;
  baseBranches?: string[];
  baseBranch?: string;
  defaultBranch?: string;
  branchList?: string[];
  description?: string | string[];

  errors?: ValidationMessage[];

  gitAuthor?: string;

  hostRules?: HostRule[];

  ignorePresets?: string[];
  includeForks?: boolean;
  isFork?: boolean;

  fileList?: string[];
  configWarningReuseIssue?: boolean;
  dependencyDashboard?: boolean;
  dependencyDashboardAutoclose?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardTitle?: string;
  dependencyDashboardHeader?: string;
  dependencyDashboardFooter?: string;
  packageFile?: string;
  packageRules?: PackageRule[];
  postUpdateOptions?: string[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;

  registryUrls?: string[];

  repoIsOnboarded?: boolean;

  updateType?: UpdateType;

  warnings?: ValidationMessage[];
  vulnerabilityAlerts?: RenovateSharedConfig;
  regexManagers?: CustomManager[];

  fetchReleaseNotes?: boolean;
}

export interface GlobalConfig extends RenovateConfig, GlobalOnlyConfig {}

export interface AssigneesAndReviewersConfig {
  assigneesFromCodeOwners?: boolean;
  assignees?: string[];
  assigneesSampleSize?: number;
  reviewersFromCodeOwners?: boolean;
  reviewers?: string[];
  reviewersSampleSize?: number;
  additionalReviewers?: string[];
}

export type UpdateType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'pin'
  | 'digest'
  | 'lockFileMaintenance'
  | 'lockfileUpdate'
  | 'rollback'
  | 'bump';

export type MatchStringsStrategy = 'any' | 'recursive' | 'combination';

// TODO: Proper typings
export interface PackageRule
  extends RenovateSharedConfig,
    UpdateConfig,
    Record<string, any> {
  matchPackageFiles?: string[];
  matchPaths?: string[];
  matchLanguages?: string[];
  matchBaseBranches?: string[];
  matchManagers?: string | string[];
  matchDatasources?: string[];
  matchDepTypes?: string[];
  matchPackageNames?: string[];
  matchPackagePatterns?: string[];
  excludePackageNames?: string[];
  excludePackagePatterns?: string[];
  matchCurrentVersion?: string | Range;
  matchSourceUrlPrefixes?: string[];
  matchUpdateTypes?: UpdateType[];
}

export interface ValidationMessage {
  depName: string;
  message: string;
}
