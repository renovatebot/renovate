import { Range } from 'semver';
import { LogLevel } from 'bunyan';
import { HostRule } from '../types';

export type RenovateConfigStage =
  | 'global'
  | 'repository'
  | 'package'
  | 'branch'
  | 'pr';

export interface GroupConfig extends Record<string, unknown> {
  branchName?: string;
  branchTopic?: string;
}

// TODO: Proper typings
export interface RenovateSharedConfig {
  automerge?: boolean;
  branchPrefix?: string;
  branchName?: string;

  commitMessage?: string;
  enabled?: boolean;
  enabledManagers?: string[];
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  ignoreDeps?: string[];
  ignorePaths?: string[];
  labels?: string[];
  managers?: string | string[];
  masterIssueApproval?: boolean;
  npmrc?: string;
  platform?: string;
  postUpgradeTasks?: PostUpgradeTasks;
  prBodyColumns?: string[];
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
  productLinks?: Record<string, string>;
  prPriority?: number;
  rebaseLabel?: string;
  rebaseWhen?: string;
  recreateClosed?: boolean;
  requiredStatusChecks?: string[];
  schedule?: string[];
  semanticCommits?: boolean;
  semanticCommitScope?: string;
  semanticCommitType?: string;
  statusCheckVerify?: boolean;
  suppressNotifications?: string[];
  timezone?: string;
  unicodeEmoji?: boolean;
}

export interface GlobalConfig {
  prBanner?: string;
  prFooter?: string;
}

export interface RenovateAdminConfig {
  allowedPostUpgradeCommands?: string[];
  autodiscover?: boolean;
  autodiscoverFilter?: string;

  baseDir?: string;
  cacheDir?: string;
  configWarningReuseIssue?: boolean;
  dryRun?: boolean;

  global?: GlobalConfig;

  localDir?: string;
  logFile?: string;
  logFileLevel?: LogLevel;
  logLevel?: LogLevel;
  logContext?: string;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingPrTitle?: string;
  onboardingConfig?: RenovateSharedConfig;

  postUpdateOptions?: string[];
  privateKey?: string | Buffer;
  repositories?: RenovateRepository[];
  requireConfig?: boolean;
  trustLevel?: 'low' | 'high';
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

// TODO: Proper typings
export interface RenovateConfig
  extends RenovateAdminConfig,
    RenovateSharedConfig,
    UpdateConfig<PackageRule>,
    Record<string, unknown> {
  baseBranches?: string[];
  baseBranch?: string;
  branchList?: string[];
  description?: string[];

  endpoint?: string;
  errors?: ValidationMessage[];
  extends?: string[];

  gitAuthor?: string;

  hostRules?: HostRule[];

  ignorePresets?: string[];
  includeForks?: boolean;
  isFork?: boolean;
  masterIssue?: boolean;
  masterIssueAutoclose?: boolean;
  masterIssueTitle?: string;

  packageRules?: PackageRule[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;
  repoIsOnboarded?: boolean;

  updateType?: UpdateType;

  warnings?: ValidationMessage[];
  vulnerabilityAlerts?: RenovateSharedConfig;
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
