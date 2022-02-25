import type { LogLevel } from 'bunyan';
import type { Range } from 'semver';
import type { AutoMergeType, HostRule, RangeStrategy } from '../types';
import type { GitNoVerifyOption } from '../util/git/types';

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
  additionalBranchPrefix?: string;
  automerge?: boolean;
  automergeType?: AutoMergeType;
  automergeStrategy?: MergeStrategy;
  branchPrefix?: string;
  branchName?: string;
  branchTopic?: string;
  manager?: string;
  commitMessage?: string;
  commitMessagePrefix?: string;
  confidential?: boolean;
  constraints?: Record<string, string>;
  draftPR?: boolean;
  enabled?: boolean;
  enabledManagers?: string[];

  encrypted?: Record<string, string>;

  extends?: string[];
  fileMatch?: string[];
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  includePaths?: string[];
  ignoreDeps?: string[];
  ignorePaths?: string[];
  ignoreTests?: boolean;
  labels?: string[];
  addLabels?: string[];
  dependencyDashboardApproval?: boolean;
  hashedBranchLength?: number;
  npmrc?: string;
  npmrcMerge?: boolean;
  npmToken?: string;
  platform?: string;
  platformAutomerge?: boolean;
  postUpgradeTasks?: PostUpgradeTasks;
  prBodyColumns?: string[];
  prBodyDefinitions?: Record<string, string>;
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
  prFooter?: string;
  prHeader?: string;
  prTitle?: string;
  productLinks?: Record<string, string>;
  prPriority?: number;
  rebaseLabel?: string;
  stopUpdatingLabel?: string;
  rangeStrategy?: RangeStrategy;
  rebaseWhen?: string;
  recreateClosed?: boolean;
  repository?: string;
  repositoryCache?: RepositoryCacheConfig;
  schedule?: string[];
  semanticCommits?: 'auto' | 'enabled' | 'disabled';
  semanticCommitScope?: string | null;
  semanticCommitType?: string;
  separateMajorMinor?: boolean;
  separateMinorPatch?: boolean;
  separateMultipleMajor?: boolean;
  stabilityDays?: number;
  suppressNotifications?: string[];
  timezone?: string;
  transitiveRemediation?: boolean;
  unicodeEmoji?: boolean;
  gitIgnoredAuthors?: string[];
  platformCommit?: boolean;
}

// Config options used only within the global worker
// The below should contain config options where stage=global
export interface GlobalOnlyConfig {
  autodiscover?: boolean;
  autodiscoverFilter?: string;
  baseDir?: string;
  cacheDir?: string;
  detectGlobalManagerConfig?: boolean;
  detectHostRulesFromEnv?: boolean;
  forceCli?: boolean;
  gitNoVerify?: GitNoVerifyOption[];
  gitPrivateKey?: string;
  globalExtends?: string[];
  logFile?: string;
  logFileLevel?: LogLevel;
  optimizeForDisabled?: boolean;
  persistRepoData?: boolean;
  prCommitsPerRunLimit?: number;
  printConfig?: boolean;
  privateKey?: string;
  privateKeyPath?: string;

  privateKeyOld?: string;
  privateKeyPathOld?: string;
  redisUrl?: string;
  repositories?: RenovateRepository[];

  writeDiscoveredRepos?: string;
}

// Config options used within the repository worker, but not user configurable
// The below should contain config options where globalOnly=true
export interface RepoGlobalConfig {
  allowCustomCrateRegistries?: boolean;
  allowPlugins?: boolean;
  allowPostUpgradeCommandTemplating?: boolean;
  allowScripts?: boolean;
  allowedPostUpgradeCommands?: string[];
  binarySource?: 'docker' | 'global' | 'install';
  customEnvVariables?: Record<string, string>;
  dockerChildPrefix?: string;
  dockerImagePrefix?: string;
  dockerUser?: string;
  dryRun?: boolean;
  executionTimeout?: number;
  exposeAllEnv?: boolean;
  migratePresets?: Record<string, string>;
  optimizeForDisabled?: boolean;
  persistRepoData?: boolean;
  privateKey?: string;
  privateKeyOld?: string;
  printConfig?: boolean;
  localDir?: string;
  cacheDir?: string;
}

export interface LegacyAdminConfig {
  endpoint?: string;

  localDir?: string;

  logContext?: string;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingCommitMessage?: string;
  onboardingNoDeps?: boolean;
  onboardingPrTitle?: string;
  onboardingConfig?: RenovateSharedConfig;
  onboardingConfigFileName?: string;

  platform?: string;
  requireConfig?: boolean;

  token?: string;
}
export type ExecutionMode = 'branch' | 'update';

export type PostUpgradeTasks = {
  commands?: string[];
  fileFilters?: string[];
  executionMode: ExecutionMode;
};

export type SubRenovateConfig<
  TKey extends string,
  TValue extends RenovateSharedConfig = RenovateSharedConfig
> = Partial<Record<TKey, TValue>>;

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
  autoReplaceStringTemplate?: string;
}

export type UseBaseBranchConfigType = 'merge' | 'none';

export interface GeneratedRenovateConfig {
  depNameSanitized?: string;

  hasBaseBranches?: boolean;
  isLockFileMaintenance?: boolean;
  isPatch?: boolean;
  isVulnerabilityAlert?: boolean;
  newMajor?: number;
  newMinor?: number;
  newValue?: string;

  sourceRepo?: string;
  sourceRepoName?: string;
  sourceRepoOrg?: string;
  sourceRepoSlug?: string;

  version?: string;
}

export interface RenovateHiddenConfig {
  /**
   * TODO: Why not public config option
   */
  dependencyDashboardPrApproval?: boolean;

  /** @deprecated */
  depType?: string;

  /** @deprecated */
  depTypeList?: string[];

  /** @deprecated */
  semanticPrefix?: string;

  vulnerabilityAlertsOnly?: boolean;
}

export type ManagerName = 'node' | 'travis';

// TODO: Proper typings
export interface RenovateConfig
  extends LegacyAdminConfig,
    RenovateSharedConfig,
    SubRenovateConfig<UpdateType, PackageRule>,
    AssigneesAndReviewersConfig,
    GeneratedRenovateConfig,
    PackageRuleInputConfig,
    RenovateHiddenConfig,
    SubRenovateConfig<ManagerName, RenovateSharedConfig> {
  aliases?: Record<string, string>;
  depName?: string;
  baseBranches?: string[];

  customEnvVariables?: Record<string, string>;
  useBaseBranchConfig?: UseBaseBranchConfigType;
  baseBranch?: string;
  defaultBranch?: string;

  branchConcurrentLimit?: number;
  branchList?: string[];
  description?: string | string[];
  force?: RenovateConfig;
  errors?: ValidationMessage[];

  gitAuthor?: string;

  hostRules?: HostRule[];

  ignorePresets?: string[];
  includeForks?: boolean;
  internalChecksFilter?: 'strict' | 'flexible' | 'none';
  isFork?: boolean;

  fileList?: string[];
  configWarningReuseIssue?: boolean;
  dependencyDashboard?: boolean;
  dependencyDashboardAutoclose?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  dependencyDashboardIssue?: number;
  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardTitle?: string;
  dependencyDashboardHeader?: string;
  dependencyDashboardFooter?: string;
  dependencyDashboardLabels?: string[];

  lockFiles?: string[];
  packageFile?: string;
  packageRules?: PackageRule[];
  postUpdateOptions?: string[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;

  pruneStaleBranches?: boolean;

  defaultRegistryUrls?: string[];
  registryUrls?: string[];

  repoIsOnboarded?: boolean;

  /** @deprecated */
  renovateJsonPresent?: boolean;

  updateType?: UpdateType;

  warnings?: ValidationMessage[];
  vulnerabilityAlerts?: RenovateSharedConfig;
  regexManagers?: CustomManager[];

  remediations?: Record<string, any[]>;

  fetchReleaseNotes?: boolean;
  secrets?: Record<string, string>;
}

export interface AllConfig extends RenovateConfig, GlobalOnlyConfig {}

export interface AssigneesAndReviewersConfig {
  assigneesFromCodeOwners?: boolean;
  assignees?: string[];
  assigneesSampleSize?: number;
  reviewersFromCodeOwners?: boolean;
  reviewers?: string[];
  reviewersSampleSize?: number;
  additionalReviewers?: string[];
  filterUnavailableUsers?: boolean;
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
  | 'bump'
  | 'replacement';

export type MatchStringsStrategy = 'any' | 'recursive' | 'combination';

export type MergeStrategy =
  | 'auto'
  | 'fast-forward'
  | 'merge-commit'
  | 'rebase'
  | 'squash';

// TODO: Proper typings
export interface PackageRule
  extends RenovateSharedConfig,
    SubRenovateConfig<UpdateType>,
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
  /**
   * If true, the option can only be configured by people with access to the Renovate instance.
   * Furthermore, the option should be documented in docs/usage/self-hosted-configuration.md.
   */
  globalOnly?: boolean;

  allowedValues?: string[];

  allowString?: boolean;

  cli?: boolean;

  description: string;

  env?: false | string;

  /**
   * Do not validate object children
   */
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
  default?: T[] | null;
  mergeable?: boolean;
  type: 'array';
  subType?: 'string' | 'object' | 'number';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateStringArrayOption extends RenovateArrayOption<string> {
  format?: 'regex';
  subType: 'string';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateNumberArrayOption extends RenovateArrayOption<number> {
  subType: 'number';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateBooleanOption extends RenovateOptionBase {
  default?: boolean | null;
  type: 'boolean';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateIntegerOption extends RenovateOptionBase {
  default?: number | null;
  type: 'integer';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateStringOption extends RenovateOptionBase {
  default?: string | null;
  format?: 'regex';

  // Not used
  replaceLineReturns?: boolean;
  type: 'string';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export interface RenovateObjectOption extends RenovateOptionBase {
  default?: any;
  additionalProperties?: Record<string, unknown> | boolean;
  mergeable?: boolean;
  type: 'object';
  supportedManagers?: string[] | 'all';
  supportedPlatforms?: string[] | 'all';
}

export type RenovateOptions =
  | RenovateStringOption
  | RenovateNumberArrayOption
  | RenovateStringArrayOption
  | RenovateIntegerOption
  | RenovateBooleanOption
  | RenovateArrayOption
  | RenovateObjectOption;

export interface PackageRuleInputConfig {
  allowedVersions?: string;
  versioning?: string;
  packageFile?: string;
  depType?: string;
  depTypes?: string[];
  depName?: string;
  currentValue?: string;
  currentVersion?: string;
  lockFiles?: string[];
  lockedVersion?: string;

  matchPackageNames?: string[];
  matchPackagePatterns?: string[];
  matchPackagePrefixes?: string[];
  updateType?: UpdateType;
  isBump?: boolean;
  sourceUrl?: string;
  language?: string;
  baseBranch?: string;
  manager?: string;
  datasource?: string;
  packageRules?: (PackageRule & PackageRuleInputConfig)[];

  replacementName?: string;
  replacementVersion?: string;
}

export interface MigratedConfig {
  isMigrated: boolean;
  migratedConfig: RenovateConfig;
}

export interface MigratedRenovateConfig extends RenovateConfig {
  endpoints?: HostRule[];

  gradle?: RenovateConfig;

  matchManagers?: string[];

  packageNames?: string[];
  packagePatterns?: string[];

  pathRules?: PackageRule[];
  packages?: PackageRule[];
}

export interface ValidationResult {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}
