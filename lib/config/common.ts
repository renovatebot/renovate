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
  managers?: string | string[];
  dependencyDashboardApproval?: boolean;
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

export interface GlobalConfig {
  prBanner?: string;
  prFooter?: string;
}

export interface RenovateAdminConfig {
  allowPostUpgradeCommandTemplating?: boolean;
  allowedPostUpgradeCommands?: string[];
  autodiscover?: boolean;
  autodiscoverFilter?: string;

  baseDir?: string;
  cacheDir?: string;
  configWarningReuseIssue?: boolean;

  dockerImagePrefix?: string;
  dockerUser?: string;

  dryRun?: boolean;

  endpoint?: string;

  global?: GlobalConfig;

  localDir?: string;
  logFile?: string;
  logFileLevel?: LogLevel;
  logLevel?: LogLevel;
  logContext?: string;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingCommitMessage?: string;
  onboardingPrTitle?: string;
  onboardingConfig?: RenovateSharedConfig;
  onboardingConfigFileName?: string;

  platform?: string;
  postUpdateOptions?: string[];
  privateKey?: string | Buffer;
  privateKeyPath?: string;
  repositories?: RenovateRepository[];
  requireConfig?: boolean;
  trustLevel?: 'low' | 'high';
  redisUrl?: string;
  gitPrivateKey?: string;
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
  extends RenovateAdminConfig,
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

  dependencyDashboard?: boolean;
  dependencyDashboardAutoclose?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardTitle?: string;
  dependencyDashboardHeader?: string;
  dependencyDashboardFooter?: string;
  packageFile?: string;
  packageRules?: PackageRule[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;

  registryUrls?: string[];

  repoIsOnboarded?: boolean;

  shouldUseForcePush?: boolean;

  updateType?: UpdateType;

  warnings?: ValidationMessage[];
  vulnerabilityAlerts?: RenovateSharedConfig;
  regexManagers?: CustomManager[];

  fetchReleaseNotes?: boolean;
}

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
  paths?: string[];
  languages?: string[];
  baseBranchList?: string[];
  datasources?: string[];
  depTypeList?: string[];
  packageNames?: string[];
  packagePatterns?: string[];
  excludePackageNames?: string[];
  excludePackagePatterns?: string[];
  matchCurrentVersion?: string | Range;
  sourceUrlPrefixes?: string[];

  updateTypes?: UpdateType[];
}

export interface ValidationMessage {
  depName: string;
  message: string;
}
