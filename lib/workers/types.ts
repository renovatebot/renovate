import type { Merge } from 'type-fest';
import type {
  GroupConfig,
  LegacyAdminConfig,
  RenovateConfig,
  RenovateSharedConfig,
  ValidationMessage,
} from '../config/types';
import type { Release } from '../modules/datasource/types';
import type { NpmManagerData } from '../modules/manager/npm/types';
import type {
  ArtifactError,
  LookupUpdate,
  PackageDependency,
  PackageFile,
  Upgrade,
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

  logJSON?: ChangeLogResult;

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
  branchName?: string;
  baseBranch?: string;
  errors?: ValidationMessage[];
  warnings?: ValidationMessage[];
  upgrades?: Upgrade<Record<string, any>>[];
  packageFiles?: PackageFile<Record<string, any>>[];

  npmLock?: string; // NEEDED:  getAdditionalFiles() cant remove ig
  yarnLock?: string; // NEEDED:  getAdditionalFiles() cant remove ig
  skipInstalls?: boolean; // NEEDED:  getAdditionalFiles() cant remove ig
  constraints?: any; // NEEDED:  getAdditionalFiles() cant remove ig
  ignoreScripts?: boolean; //NEEDED:  getAdditionalFiles() cant remove ig
  postUpdateOptions?: string[]; //NEEDED:  getAdditionalFiles() cant remove ig
  managerData?: NpmManagerData; //NEEDED:  getAdditionalFiles() cant remove ig

  stabilityStatus?: BranchStatus; // UNSURE: discuss
  minimumConfidence?: string; // UNSURE: discuss
  confidenceStatus?: BranchStatus; // UNSURE: discuss
  dependencyDashboardRebaseAllOpen?: boolean; // UNSURE: discuss

  draftPR?: boolean; //UNSURE: search again
  packageFile?: any; // UNSURE: search again
  labels?: string[]; // UNSURE: search again
  addLabels?: string[]; // UNSURE: search again
  releaseTimestamp?: string; // UNSURE: search again
  stopUpdatingLabel?: string; // UNSURE: search again
  dependencyDashboardApproval?: boolean; // UNSURE: search again

  manager?: string; // UNSURE:  executePostUpgradeCommands() -- recheck
  fileFilters?: unknown; // UNSURE:  executePostUpgradeCommands() -- recheck

  pendingChecks?: boolean; // UNSURE: validation-section
  isVulnerabilityAlert?: unknown; // UNSURE: validation-section
  dependencyDashboardChecks?: Record<string, string>; // UNSURE: validation-section

  automergeType?: string[]; // UNSURE: getPlatformOptions() + tryBranchAutomerge() + checkAutoMerge()
  automerge?: boolean; //UNSURE: getPrBody() + // UNSURE: getPlatformOptions() + tryBranchAutomerge() + ensurePr()

  userString?: Record<string, string>; // UNSURE: handlepr()
  updateType?: string; // UNSURE: handlepr() +  getAdditionalFiles()
  suppressNotifications?: string[]; // UNSUREL handlepr() + ensurePr()

  forceCommit?: boolean; // UNSURE:   commitFilesToBranch()
  commitMessage?: string; // UNSURE:   commitFilesToBranch()
  platformCommit?: boolean; // UNSURE:   commitFilesToBranch()
  excludeCommitPaths?: string[]; // UNSURE:  commitFilesToBranch()

  azureWorkItemId: number; // UNSURE: getPlatformOptions()
  azureAutoApprove: boolean; // UNSURE: getPlatformOptions()
  platformAutomerge?: unknown; // UNSURE: getPlatformOptions()
  bbUseDefaultReviewers: boolean; // UNSURE: getPlatformOptions()
  gitLabIgnoreApprovals: boolean; // UNSURE: getPlatformOptions()

  isPin?: boolean; //UNSURE: getPrBody()
  prFooter?: string; //UNSURE: getPrBody()
  prHeader?: string; //UNSURE: getPrBody()
  schedule?: string[]; //UNSURE: getPrBody()
  rebaseWhen?: string; //UNSURE: getPrBody()
  prBodyTemplate?: string; //UNSURE: getPrBody()
  prBodyColumns?: string[]; //UNSURE: getPrBody()
  timezone?: string; //UNSURE: getPrBody() + schedule
  hasReleaseNotes?: boolean; //UNSURE: getPrBody() + ensurePr()
  automergeSchedule?: string[]; //UNSURE: getPrBody() + schedule
  ignoreTests?: boolean; //UNSURE: getPrBody() + tryBranchAutomerge()
  recreateClosed?: boolean; // UNSURE: getPrBody() + prAlreadyExisted()
  prTitle?: string; // UNSURE: prAlreadyExisted()

  isScheduleNow?: boolean; // REMOVED: schedule related
  updateNotScheduled?: boolean; // REMOVED: schedule related

  rebaseRequested?: boolean; // REMOVED: reason: internally computed in processBranch()
  updatedPackageFiles?: FileChange[]; // REMOVED:  internally computed in processBranch() -> getPackageUpdateFiles()

  isConflicted?: boolean; // REMOVED: internally computed in processBranch() -> shouldReuseExistingBranch()
  reuseExistingBranch?: boolean; // REMOVED: internally computed in processBranch() -> shouldReuseExistingBranch()
  updatedArtifacts?: FileChange[]; // REMOVED: internally computed in processBranch() -> shouldReuseExistingBranch()
  artifactErrors?: ArtifactError[]; // REMOVED: internally computed in processBranch() -> shouldReuseExistingBranch()

  forcePr?: boolean; // REMOVED: ensurePr()
  assignees?: string[]; // REMOVED: ensurePr()
  reviewers?: string[]; // REMOVED: ensurePr()
  stopUpdating?: boolean; // REMOVED: ensurePr()
  committedFiles?: unknown; // REMOVED: ensurePr()
  assignAutomerge?: unknown; // REMOVED: ensurePr()
  prNotPendingHours?: unknown; // REMOVED: ensurePr()
  assigneesSampleSize?: number; // REMOVED: ensurePr()
  reviewersSampleSize?: number; // REMOVED: ensurePr()
  additionalReviewers?: string[]; // REMOVED: ensurePr()
  assigneesFromCodeOwners?: boolean; // REMOVED: ensurePr()
  branchAutomergeFailureMessage?: string; // REMOVED: ensurePr()
  filterUnavailableUsers?: Promise<string[]>; // REMOVED: ensurePr()
  prCreation?: 'immediate' | 'not-pending' | 'status-success' | 'approval'; // REMOVED: ensurePr()
}

export interface NarrowedRenovateConfig extends Record<string, any> {
  repoIsOnboarded?: boolean;
  prHourlyLimit?: number;
  onboardingBranch?: string;
  branchPrefix?: string;
  prConcurrentLimit?: number;
  branchConcurrentLimit?: number;
}

export interface CacheConfig
  extends NarrowedRenovateConfig,
    Record<string, any> {
  manager?: string;
  fileFilters?: unknown;
  prTitle?: string;
  rebaseLabel?: string;
  branchPrefixOld?: string;
  branchPrefix?: string;
  updateLockFiles?: any;
  transitiveRemediation?: any;
  upgrades?: Upgrade<Record<string, any>>[];
  updateType?: string;
  branchName?: string;
  baseBranch?: string;
  npmLock?: string;
  yarnLock?: string;
  skipInstalls?: boolean;
  constraints?: any;
  ignoreScripts?: boolean;
  packageFile?: any;
  postUpdateOptions?: string[];
  managerData?: NpmManagerData;
  packageFiles?: PackageFile<Record<string, any>>[];
  releaseTimestamp?: string;
  stopUpdatingLabel?: string;
  excludeCommitPaths?: string[];
  commitMessage?: string;
  forceCommit?: boolean;
  platformCommit?: boolean;
  ignoreTests?: boolean;
  rebaseWhen?: string;
  errors?: ValidationMessage[];
  warnings?: ValidationMessage[];
  isVulnerabilityAlert?: unknown;
  suppressNotifications?: string[];
  automerge?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  automergeType?: string[];
  labels?: string[];
  addLabels?: string[];
  platformAutomerge?: unknown;
  azureAutoApprove: boolean;
  azureWorkItemId: number;
  bbUseDefaultReviewers: boolean;
  gitLabIgnoreApprovals: boolean;
  recreateClosed?: boolean;
  userString?: Record<string, string>;
  dependencyDashboardApproval?: boolean;
  pendingChecks?: boolean;
  isPin?: boolean;
  hasReleaseNotes?: boolean;
  schdeule?: string[];
  timezone?: string;
  prFooter?: string;
  dependencyDashboardRebaseAllOpen?: boolean;
  prBodyColumns?: string[];
  prHeader?: string;
  prBodyTemplate?: string;
  automergeSchedule?: string[];
}
