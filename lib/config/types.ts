import type { LogLevel } from 'bunyan';
import type { PlatformId } from '../constants';
import type { LogLevelRemap } from '../logger/types';
import type { CustomManager } from '../modules/manager/custom/types';
import type { HostRule } from '../types';
import type { GitNoVerifyOption } from '../util/git/types';
import type { MergeConfidence } from '../util/merge-confidence/types';

export type RenovateConfigStage =
  | 'global'
  | 'inherit'
  | 'repository'
  | 'package'
  | 'branch'
  | 'pr';

export type RepositoryCacheConfig = 'disabled' | 'enabled' | 'reset';
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type RepositoryCacheType = 'local' | string;
export type DryRunConfig = 'extract' | 'lookup' | 'full';
export type RequiredConfig = 'required' | 'optional' | 'ignored';

export interface GroupConfig extends Record<string, unknown> {
  branchName?: string;
  branchTopic?: string;
}

export type RecreateWhen = 'auto' | 'never' | 'always';
// TODO: Proper typings
export interface RenovateSharedConfig {
  $schema?: string;
  addLabels?: string[];
  autoReplaceGlobalMatch?: boolean;
  automerge?: boolean;
  automergeSchedule?: string[];
  automergeStrategy?: MergeStrategy;
  branchName?: string;
  branchNameStrict?: boolean;
  branchPrefix?: string;
  branchPrefixOld?: string;
  commitMessage?: string;
  commitMessageAction?: string;
  commitMessageExtra?: string;
  commitMessageLowerCase?: 'auto' | 'never';
  commitMessagePrefix?: string;
  commitMessageTopic?: string;
  confidential?: boolean;
  customChangelogUrl?: string;
  dependencyDashboardApproval?: boolean;
  draftPR?: boolean;
  enabled?: boolean;
  enabledManagers?: string[];
  extends?: string[];
  fileMatch?: string[];
  force?: RenovateConfig;
  gitIgnoredAuthors?: string[];
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  hashedBranchLength?: number;
  ignoreDeps?: string[];
  ignorePaths?: string[];
  ignoreTests?: boolean;
  includePaths?: string[];
  internalChecksAsSuccess?: boolean;
  keepUpdatedLabel?: string;
  labels?: string[];
  manager?: string;
  milestone?: number;
  npmrc?: string;
  npmrcMerge?: boolean;
  platformCommit?: boolean;
  postUpgradeTasks?: PostUpgradeTasks;
  prBodyColumns?: string[];
  prBodyDefinitions?: Record<string, string>;
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
  prPriority?: number;
  productLinks?: Record<string, string>;
  pruneBranchAfterAutomerge?: boolean;
  rebaseLabel?: string;
  rebaseWhen?: string;
  recreateClosed?: boolean;
  recreateWhen?: RecreateWhen;
  repository?: string;
  repositoryCache?: RepositoryCacheConfig;
  repositoryCacheType?: RepositoryCacheType;
  respectLatest?: boolean;
  schedule?: string[];
  semanticCommitScope?: string | null;
  semanticCommitType?: string;
  semanticCommits?: 'auto' | 'enabled' | 'disabled';
  stopUpdatingLabel?: string;
  suppressNotifications?: string[];
  timezone?: string;
  unicodeEmoji?: boolean;
}

// Config options used only within the global worker
// The below should contain config options where stage=global
export interface GlobalOnlyConfig {
  autodiscover?: boolean;
  autodiscoverFilter?: string[] | string;
  autodiscoverNamespaces?: string[];
  autodiscoverProjects?: string[];
  autodiscoverTopics?: string[];
  baseDir?: string;
  cacheDir?: string;
  containerbaseDir?: string;
  detectHostRulesFromEnv?: boolean;
  dockerCliOptions?: string;
  endpoint?: string;
  forceCli?: boolean;
  gitNoVerify?: GitNoVerifyOption[];
  gitPrivateKey?: string;
  globalExtends?: string[];
  logFile?: string;
  logFileLevel?: LogLevel;
  platform?: PlatformId;
  prCommitsPerRunLimit?: number;
  privateKeyPath?: string;
  privateKeyPathOld?: string;
  redisPrefix?: string;
  redisUrl?: string;
  repositories?: RenovateRepository[];
  useCloudMetadataServices?: boolean;
}

// Config options used within the repository worker, but not user configurable
// The below should contain config options where globalOnly=true
export interface RepoGlobalConfig {
  allowCustomCrateRegistries?: boolean;
  allowPlugins?: boolean;
  allowPostUpgradeCommandTemplating?: boolean;
  allowScripts?: boolean;
  allowedEnv?: string[];
  allowedHeaders?: string[];
  allowedPostUpgradeCommands?: string[];
  binarySource?: 'docker' | 'global' | 'install' | 'hermit';
  cacheDir?: string;
  cacheHardTtlMinutes?: number;
  cacheTtlOverride?: Record<string, number>;
  containerbaseDir?: string;
  customEnvVariables?: Record<string, string>;
  dockerChildPrefix?: string;
  dockerCliOptions?: string;
  dockerSidecarImage?: string;
  dockerUser?: string;
  dryRun?: DryRunConfig;
  endpoint?: string;
  executionTimeout?: number;
  exposeAllEnv?: boolean;
  gitTimeout?: number;
  githubTokenWarn?: boolean;
  includeMirrors?: boolean;
  localDir?: string;
  migratePresets?: Record<string, string>;
  platform?: PlatformId;
  presetCachePersistence?: boolean;
  privateKey?: string;
  privateKeyOld?: string;
}

export interface LegacyAdminConfig {
  localDir?: string;

  logContext?: string;

  onboarding?: boolean;
  onboardingBranch?: string;
  onboardingCommitMessage?: string;
  onboardingNoDeps?: boolean;
  onboardingRebaseCheckbox?: boolean;
  onboardingPrTitle?: string;
  onboardingConfig?: RenovateSharedConfig;
  onboardingConfigFileName?: string;

  requireConfig?: RequiredConfig;
}

export type ExecutionMode = 'branch' | 'update';

export interface PostUpgradeTasks {
  commands?: string[];
  fileFilters?: string[];
  executionMode: ExecutionMode;
}

export type UpdateConfig<
  T extends RenovateSharedConfig = RenovateSharedConfig,
> = Partial<Record<UpdateType, T | null>>;

export type RenovateRepository =
  | string
  | {
      repository: string;
      secrets?: Record<string, string>;
    };

export type UseBaseBranchConfigType = 'merge' | 'none';
export type ConstraintsFilter = 'strict' | 'none';

export const allowedStatusCheckStrings = [
  'minimumReleaseAge',
  'mergeConfidence',
  'configValidation',
  'artifactError',
] as const;
export type StatusCheckKey = (typeof allowedStatusCheckStrings)[number];
export type UserEnv = Record<string, string>;

// TODO: Proper typings
export interface RenovateConfig
  extends LegacyAdminConfig,
    RenovateSharedConfig,
    UpdateConfig<PackageRule>,
    AssigneesAndReviewersConfig,
    ConfigMigration,
    Record<string, unknown> {
  reportPath?: string;
  reportType?: 'logging' | 'file' | 's3' | null;
  depName?: string;
  baseBranches?: string[];
  commitBody?: string;
  useBaseBranchConfig?: UseBaseBranchConfigType;
  baseBranch?: string;
  defaultBranch?: string;
  branchList?: string[];
  description?: string | string[];
  force?: RenovateConfig;
  errors?: ValidationMessage[];

  gitAuthor?: string;

  hostRules?: HostRule[];

  inheritConfig?: boolean;
  inheritConfigFileName?: string;
  inheritConfigRepoName?: string;
  inheritConfigStrict?: boolean;

  ignorePresets?: string[];
  forkProcessing?: 'auto' | 'enabled' | 'disabled';
  isFork?: boolean;

  fileList?: string[];
  configWarningReuseIssue?: boolean;
  dependencyDashboard?: boolean;
  dependencyDashboardAutoclose?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  dependencyDashboardIssue?: number;
  dependencyDashboardTitle?: string;
  dependencyDashboardHeader?: string;
  dependencyDashboardFooter?: string;
  dependencyDashboardLabels?: string[];
  dependencyDashboardOSVVulnerabilitySummary?: 'none' | 'all' | 'unresolved';
  packageFile?: string;
  packageRules?: PackageRule[];
  postUpdateOptions?: string[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;
  forkModeDisallowMaintainerEdits?: boolean;

  defaultRegistryUrls?: string[];
  registryUrls?: string[] | null;
  registryAliases?: Record<string, string>;

  repoIsOnboarded?: boolean;
  repoIsActivated?: boolean;

  updateInternalDeps?: boolean;
  updateType?: UpdateType;

  warnings?: ValidationMessage[];
  vulnerabilityAlerts?: RenovateSharedConfig;
  osvVulnerabilityAlerts?: boolean;
  vulnerabilitySeverity?: string;
  customManagers?: CustomManager[];
  customDatasources?: Record<string, CustomDatasourceConfig>;

  fetchChangeLogs?: FetchChangeLogsOptions;
  secrets?: Record<string, string>;

  constraints?: Record<string, string>;
  skipInstalls?: boolean | null;

  constraintsFiltering?: ConstraintsFilter;

  checkedBranches?: string[];
  customizeDashboard?: Record<string, string>;

  statusCheckNames?: Record<StatusCheckKey, string | null>;
  env?: UserEnv;
  logLevelRemap?: LogLevelRemap[];
}

const CustomDatasourceFormats = ['json', 'plain', 'yaml', 'html'] as const;
export type CustomDatasourceFormats = (typeof CustomDatasourceFormats)[number];

export interface CustomDatasourceConfig {
  defaultRegistryUrlTemplate?: string;
  format?: CustomDatasourceFormats;
  transformTemplates?: string[];
}

export interface AllConfig
  extends RenovateConfig,
    GlobalOnlyConfig,
    RepoGlobalConfig {}

export interface AssigneesAndReviewersConfig {
  assigneesFromCodeOwners?: boolean;
  expandCodeOwnersGroups?: boolean;
  assignees?: string[];
  assigneesSampleSize?: number;
  ignoreReviewers?: string[];
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
  | 'pinDigest'
  | 'lockFileMaintenance'
  | 'lockfileUpdate'
  | 'rollback'
  | 'bump'
  | 'replacement';

export type FetchChangeLogsOptions = 'off' | 'branch' | 'pr';

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
    UpdateConfig,
    Record<string, unknown> {
  description?: string | string[];
  excludeDepNames?: string[];
  excludeDepPatterns?: string[];
  excludePackageNames?: string[];
  excludePackagePatterns?: string[];
  excludePackagePrefixes?: string[];
  excludeRepositories?: string[];
  isVulnerabilityAlert?: boolean;
  matchBaseBranches?: string[];
  matchCategories?: string[];
  matchConfidence?: MergeConfidence[];
  matchCurrentAge?: string;
  matchCurrentValue?: string;
  matchCurrentVersion?: string;
  matchDatasources?: string[];
  matchDepNames?: string[];
  matchDepPatterns?: string[];
  matchDepTypes?: string[];
  matchFileNames?: string[];
  matchManagers?: string[];
  matchNewValue?: string;
  matchPackageNames?: string[];
  matchPackagePatterns?: string[];
  matchPackagePrefixes?: string[];
  matchRepositories?: string[];
  matchSourceUrlPrefixes?: string[];
  matchSourceUrls?: string[];
  matchUpdateTypes?: UpdateType[];
  registryUrls?: string[] | null;
  vulnerabilitySeverity?: string;
}

export interface ValidationMessage {
  topic: string;
  message: string;
}

export type AllowedParents =
  | 'customManagers'
  | 'customDatasources'
  | 'hostRules'
  | 'postUpgradeTasks'
  | 'packageRules'
  | 'logLevelRemap';
export interface RenovateOptionBase {
  /**
   * If true, the option can only be configured by people with access to the Renovate instance.
   * Furthermore, the option should be documented in docs/usage/self-hosted-configuration.md.
   */
  globalOnly?: boolean;

  inheritConfigSupport?: boolean;

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

  parents?: AllowedParents[];

  stage?: RenovateConfigStage;

  experimental?: boolean;

  experimentalDescription?: string;

  experimentalIssues?: number[];

  advancedUse?: boolean;

  /**
   * This is used to add depreciation message in the docs
   */
  deprecationMsg?: string;
}

export interface RenovateArrayOption<
  T extends string | number | Record<string, unknown> = Record<string, unknown>,
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

export interface PackageRuleInputConfig extends Record<string, unknown> {
  versioning?: string;
  packageFile?: string;
  lockFiles?: string[];
  depType?: string;
  depTypes?: string[];
  depName?: string;
  packageName?: string | null;
  newValue?: string | null;
  currentValue?: string | null;
  currentVersion?: string;
  lockedVersion?: string;
  updateType?: UpdateType;
  mergeConfidenceLevel?: MergeConfidence | undefined;
  isBump?: boolean;
  sourceUrl?: string | null;
  categories?: string[];
  baseBranch?: string;
  manager?: string;
  datasource?: string;
  packageRules?: (PackageRule & PackageRuleInputConfig)[];
  releaseTimestamp?: string | null;
  repository?: string;
  currentVersionTimestamp?: string;
}

export interface ConfigMigration {
  configMigration?: boolean;
}

export interface MigratedConfig {
  isMigrated: boolean;
  migratedConfig: RenovateConfig;
}

export interface MigratedRenovateConfig extends RenovateConfig {
  endpoints?: HostRule[];
  pathRules: PackageRule[];
  packages: PackageRule[];

  node?: RenovateConfig;
  travis?: RenovateConfig;
  gradle?: RenovateConfig;
}

export interface ManagerConfig extends RenovateConfig {
  manager: string;
}

export interface ValidationResult {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}
