import { Range } from 'semver';

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
  branchName?: string;

  commitMessage?: string;
  enabled?: boolean;

  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  ignoreDeps?: string[];
  labels?: string[];
  managers?: string | string[];
  masterIssueApproval?: boolean;
  platform?: string;
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
  productLinks?: Record<string, string>;
  prPriority?: number;
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
  postUpgradeTasks?: PostUpgradeTasks;
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
  dryRun?: boolean;

  global?: GlobalConfig;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingConfig?: RenovateSharedConfig;
  privateKey?: string | Buffer;
  repositories?: RenovateRepository[];
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
  errors?: ValidationMessage[];

  includeForks?: boolean;
  isFork?: boolean;

  localDir?: string;

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
