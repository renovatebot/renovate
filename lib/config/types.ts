import type { LogLevel } from 'bunyan';
import type { Range } from 'semver';
import type { HostRule } from '../types';

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
  gitIgnoredAuthors?: string[];
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
  prCommitsPerRunLimit?: number;
  privateKeyPath?: string;
  redisUrl?: string;
  repositories?: RenovateRepository[];
}

// Config options used within the repository worker, but not user configurable
// The below should contain config options where admin=true
export interface RepoAdminConfig {
  allowCustomCrateRegistries?: boolean;
  allowPostUpgradeCommandTemplating?: boolean;
  allowScripts?: boolean;
  allowedPostUpgradeCommands?: string[];
  customEnvVariables?: Record<string, string>;
  dockerChildPrefix?: string;
  dockerImagePrefix?: string;
  dockerUser?: string;
  dryRun?: boolean;
  exposeAllEnv?: boolean;
  privateKey?: string | Buffer;
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
export type ExecutionMode = 'branch' | 'update';

export type PostUpgradeTasks = {
  commands?: string[];
  fileFilters?: string[];
  executionMode: ExecutionMode;
};

type UpdateConfig<
  T extends RenovateSharedConfig = RenovateSharedConfig
> = Partial<Record<UpdateType, T>>;

export type RenovateRepository =
  | string
  | {
      repository: string;
      secrets?: Record<string, string>;
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
  force?: RenovateConfig;
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
  secrets?: Record<string, string>;
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
  matchFiles?: string[];
  matchPaths?: string[];
  matchLanguages?: string[];
  matchBaseBranches?: string[];
  matchManagers?: string | string[];
  matchDatasources?: string[];
  matchDepTypes?: string[];
  matchPackageNames?: string[];
  matchPackagePatterns?: string[];
  matchPackagePrefixes?: string[];
  excludePackageNames?: string[];
  excludePackagePatterns?: string[];
  excludePackagePrefixes?: string[];
  matchCurrentVersion?: string | Range;
  matchSourceUrlPrefixes?: string[];
  matchUpdateTypes?: UpdateType[];
}

export interface ValidationMessage {
  topic: string;
  message: string;
}

export interface RenovateOptionBase {
  admin?: boolean;

  allowedValues?: string[];

  allowString?: boolean;

  cli?: boolean;

  description: string;

  env?: false | string;

  freeChoice?: boolean;
  mergeable?: boolean;

  autogenerated?: boolean;

  name: string;

  parent?: 'hostRules' | 'packageRules' | 'postUpgradeTasks' | 'regexManagers';

  // used by tests
  relatedOptions?: string[];

  releaseStatus?: 'alpha' | 'beta' | 'unpublished';

  stage?: RenovateConfigStage;
}

export interface RenovateArrayOption<
  T extends string | number | Record<string, unknown> = Record<string, unknown>
> extends RenovateOptionBase {
  default?: T[];
  mergeable?: boolean;
  type: 'array';
  subType?: 'string' | 'object' | 'number';
}

export interface RenovateStringArrayOption extends RenovateArrayOption<string> {
  format?: 'regex';
  subType: 'string';
}

export interface RenovateNumberArrayOption extends RenovateArrayOption<number> {
  subType: 'number';
}

export interface RenovateBooleanOption extends RenovateOptionBase {
  default?: boolean;
  type: 'boolean';
}

export interface RenovateIntegerOption extends RenovateOptionBase {
  default?: number;
  type: 'integer';
}

export interface RenovateStringOption extends RenovateOptionBase {
  default?: string;
  format?: 'regex';

  // Not used
  replaceLineReturns?: boolean;
  type: 'string';
}

export interface RenovateObjectOption extends RenovateOptionBase {
  default?: any;
  additionalProperties?: Record<string, unknown> | boolean;
  mergeable?: boolean;
  type: 'object';
}

export type RenovateOptions =
  | RenovateStringOption
  | RenovateNumberArrayOption
  | RenovateStringArrayOption
  | RenovateIntegerOption
  | RenovateBooleanOption
  | RenovateArrayOption
  | RenovateObjectOption;

export interface PackageRuleInputConfig extends Record<string, unknown> {
  versioning?: string;
  packageFile?: string;
  depType?: string;
  depTypes?: string[];
  depName?: string;
  currentValue?: string;
  currentVersion?: string;
  lockedVersion?: string;
  updateType?: UpdateType;
  isBump?: boolean;
  sourceUrl?: string;
  language?: string;
  baseBranch?: string;
  manager?: string;
  datasource?: string;
  packageRules?: (PackageRule & PackageRuleInputConfig)[];
}

export interface ManagerConfig extends RenovateConfig {
  language: string;
  manager: string;
}
