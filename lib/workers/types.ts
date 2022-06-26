import type { Merge } from 'type-fest';
import type {
  GroupConfig,
  LegacyAdminConfig,
  RegExManager,
  RenovateConfig,
  RenovateSharedConfig,
  UpdateType,
  ValidationMessage,
} from '../config/types';
import type { Release } from '../modules/datasource/types';
import type { NpmManagerData } from '../modules/manager/npm/types';
import type {
  ArtifactError,
  CustomExtractConfig,
  ExtractConfig,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../modules/manager/types';
import type { PlatformPrOptions } from '../modules/platform/types';
import type { BranchStatus } from '../types';
import type { FileChange } from '../util/git/types';
import type { MergeConfidence } from '../util/merge-confidence';
import type {
  ChangeLogRelease,
  ChangeLogResult,
} from './repository/update/pr/changelog/types';

export type ReleaseWithNotes = Release & Partial<ChangeLogRelease>;

export interface BranchUpgradeConfig
  extends Merge<RenovateConfig, PackageDependency>,
    Partial<LookupUpdate>,
    RenovateSharedConfig {
  artifactErrors?: ArtifactError[];
  autoReplaceStringTemplate?: string;
  baseDeps?: PackageDependency[];
  branchName: string;
  commitBody?: string;
  commitMessage?: string;
  commitMessageExtra?: string;
  currentDigest?: string;
  currentDigestShort?: string;
  currentValue?: string;
  excludeCommitPaths?: string[];
  githubName?: string;
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
  language?: string;
  manager: string;
  packageFile?: string;
  lockFile?: string;
  lockFiles?: string[];
  reuseExistingBranch?: boolean;
  prHeader?: string;
  prFooter?: string;
  prBodyNotes?: string[];
  prBodyTemplate?: string;
  prPriority?: number;
  prTitle?: string;
  releases?: ReleaseWithNotes[];
  releaseTimestamp?: string;
  repoName?: string;
  minimumConfidence?: MergeConfidence;
  sourceDirectory?: string;

  updatedPackageFiles?: FileChange[];
  updatedArtifacts?: FileChange[];

  logJSON?: ChangeLogResult | null;

  hasReleaseNotes?: boolean;
  homepage?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  sourceUrl?: string;
  sourceRepo?: string;
  sourceRepoOrg?: string;
  sourceRepoName?: string;
}

export type PrBlockedBy =
  | 'BranchAutomerge'
  | 'NeedsApproval'
  | 'AwaitingTests'
  | 'RateLimited'
  | 'Error';

// eslint-disable-next-line typescript-enum/no-enum
export enum BranchResult {
  AlreadyExisted = 'already-existed',
  Automerged = 'automerged',
  Done = 'done',
  Error = 'error',
  NeedsApproval = 'needs-approval',
  NeedsPrApproval = 'needs-pr-approval',
  NotScheduled = 'not-scheduled',
  NoWork = 'no-work',
  Pending = 'pending',
  PrCreated = 'pr-created',
  PrEdited = 'pr-edited',
  PrLimitReached = 'pr-limit-reached',
  CommitLimitReached = 'commit-limit-reached',
  BranchLimitReached = 'branch-limit-reached',
  Rebase = 'rebase',
  UpdateNotScheduled = 'update-not-scheduled',
}

export interface BranchConfig
  extends BranchUpgradeConfig,
    LegacyAdminConfig,
    PlatformPrOptions {
  automergeComment?: string;
  automergeType?: string;
  baseBranch?: string;
  errors?: ValidationMessage[];
  hasTypes?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  releaseTimestamp?: string;
  forceCommit?: boolean;
  rebaseRequested?: boolean;
  result?: BranchResult;
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
  prBlockedBy?: PrBlockedBy;
  prNo?: number;
  stopUpdating?: boolean;
  isConflicted?: boolean;
}

export interface NarrowedBranchConfig extends Record<string, any> {
  rebaseLabel?: string;
  branchPrefixOld?: string;
  branchPrefix?: string;
  updateLockFiles?: any;
  transitiveRemediation?: any;
  branchName: string;
  baseBranch?: string;
  errors?: ValidationMessage[];
  warnings?: ValidationMessage[];
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
  npmLock?: string;
  yarnLock?: string;
  skipInstalls?: boolean;
  constraints?: any;
  ignoreScripts?: boolean;
  postUpdateOptions?: string[];
  managerData?: NpmManagerData;
  manager: string;
  fileFilters?: unknown;
  forceCommit?: boolean;
  commitMessage?: string;
  platformCommit?: boolean;
  excludeCommitPaths?: string[];
  dependencyDashboardApproval?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  pendingChecks?: boolean;
  isVulnerabilityAlert?: unknown;

  stabilityStatus?: BranchStatus;
  minimumConfidence?: string;
  confidenceStatus?: BranchStatus;
  dependencyDashboardRebaseAllOpen?: boolean;

  packageFile?: any;

  automergeType?: string;
  automerge?: boolean;

  updateType?: UpdateType;
  suppressNotifications?: string[];

  azureWorkItemId?: number;
  azureAutoApprove?: boolean;
  platformAutomerge?: unknown;
  bbUseDefaultReviewers?: boolean;
  gitLabIgnoreApprovals?: boolean;

  isPin?: boolean;
  prFooter?: string;
  prHeader?: string;
  schedule?: string[];
  rebaseWhen?: string;
  prBodyTemplate?: string;
  prBodyColumns?: string[];
  timezone?: string;
  hasReleaseNotes?: boolean;
  automergeSchedule?: string[];
  ignoreTests?: boolean;
  recreateClosed?: boolean;
  prTitle?: string;

  isConflicted?: boolean;
  reuseExistingBranch?: boolean;
  updatedArtifacts?: FileChange[];
  artifactErrors?: ArtifactError[];

  //Below properties are not present in config which is used for caching -> UpdateCacheConfig
  userString?: Record<string, string>;
  draftPR?: boolean;
  labels?: string[];
  addLabels?: string[];
  releaseTimestamp?: string;
  stopUpdatingLabel?: string;

  isScheduleNow?: boolean;
  updateNotScheduled?: boolean;

  rebaseRequested?: boolean;
  updatedPackageFiles?: FileChange[];

  forcePr?: boolean;
  assignees?: string[];
  reviewers?: string[];
  stopUpdating?: boolean;
  committedFiles?: unknown;
  assignAutomerge?: unknown;
  prNotPendingHours?: unknown;
  assigneesSampleSize?: number;
  reviewersSampleSize?: number;
  additionalReviewers?: string[];
  assigneesFromCodeOwners?: boolean;
  branchAutomergeFailureMessage?: string;
  filterUnavailableUsers?: boolean;
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval';
}

export interface UpdateCacheConfig extends Record<string, any> {
  rebaseLabel?: string;
  branchPrefixOld?: string;
  branchPrefix?: string;
  updateLockFiles?: any;
  transitiveRemediation?: any;
  branchName: string;
  baseBranch?: string;
  errors?: ValidationMessage[];
  warnings?: ValidationMessage[];
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
  npmLock?: string;
  yarnLock?: string;
  skipInstalls?: boolean;
  constraints?: any;
  ignoreScripts?: boolean;
  postUpdateOptions?: string[];
  managerData?: NpmManagerData;
  manager: string;
  fileFilters?: unknown;
  forceCommit?: boolean;
  commitMessage?: string;
  platformCommit?: boolean;
  excludeCommitPaths?: string[];
  dependencyDashboardApproval?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  pendingChecks?: boolean;
  isVulnerabilityAlert?: unknown;

  stabilityStatus?: BranchStatus;
  minimumConfidence?: string;
  confidenceStatus?: BranchStatus;
  dependencyDashboardRebaseAllOpen?: boolean;

  packageFile?: any;

  automergeType?: string;
  automerge?: boolean;

  updateType?: UpdateType;
  suppressNotifications?: string[];

  azureWorkItemId?: number;
  azureAutoApprove?: boolean;
  platformAutomerge?: unknown;
  bbUseDefaultReviewers?: boolean;
  gitLabIgnoreApprovals?: boolean;

  isPin?: boolean;
  prFooter?: string;
  prHeader?: string;
  schedule?: string[];

  rebaseWhen?: string;
  prBodyTemplate?: string;
  prBodyColumns?: string[];
  timezone?: string;
  hasReleaseNotes?: boolean;
  automergeSchedule?: string[];
  ignoreTests?: boolean;
  recreateClosed?: boolean;
  prTitle?: string;

  isConflicted?: boolean;
  reuseExistingBranch?: boolean;
  updatedArtifacts?: FileChange[];
  artifactErrors?: ArtifactError[];
}
export interface WorkerExtractConfig
  extends ExtractConfig,
    Partial<CustomExtractConfig> {
  manager: string;
  fileList: string[];
  fileMatch?: string[];
  updateInternalDeps?: boolean;
  includePaths?: string[];
  ignorePaths?: string[];
  regexManagers?: RegExManager[];
  enabledManagers?: string[];
  enabled?: boolean;
}
