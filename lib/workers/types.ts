import type { Merge } from 'type-fest';
import type {
  GroupConfig,
  LegacyAdminConfig,
  RenovateConfig,
  RenovateSharedConfig,
  ValidationMessage,
} from '../config/types';
import type { Release } from '../modules/datasource/types';
import type {
  ArtifactError,
  ArtifactNotice,
  ExtractConfig,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../modules/manager/types';
import type { PlatformPrOptions } from '../modules/platform/types';
import type { BranchStatus } from '../types';
import type { FileChange } from '../util/git/types';
import type { MergeConfidence } from '../util/merge-confidence/types';
import type { Timestamp } from '../util/timestamp';
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
  artifactNotices?: ArtifactNotice[];
  autoReplaceStringTemplate?: string;
  baseDeps?: PackageDependency[];
  branchName: string;
  commitBody?: string;
  commitMessage?: string;
  commitMessageExtra?: string;
  currentDigest?: string;
  currentDigestShort?: string;
  currentValue?: string;

  currentValueTemplate?: string;

  dependencyDashboardCategory?: string;
  depIndex?: number;
  depNameLinked?: string;
  depNameSanitized?: string;
  depNameTemplate?: string;
  depTypes?: string[];

  displayFrom?: string;
  displayPending?: string;
  displayTo?: string;

  excludeCommitPaths?: string[];
  githubName?: string;
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;

  isDigest?: boolean;
  isGroup?: boolean;
  isLockFileMaintenance?: boolean;
  isMajor?: boolean;
  isMinor?: boolean;
  isPatch?: boolean;
  isRemediation?: boolean;

  manager: string;
  newDigestShort?: string;
  newNameLinked?: string;

  packageFile?: string;
  packageFileDir?: string;
  parentDir?: string;

  lockFile?: string;
  lockFiles?: string[];
  reuseExistingBranch?: boolean;
  prHeader?: string;
  prFooter?: string;
  prBodyNotes?: string[];
  prBodyTemplate?: string;
  prPriority?: number;
  prTitle?: string;
  prTitleStrict?: boolean;
  prettyNewMajor?: string;
  prettyNewVersion?: string;
  references?: string;
  releases?: ReleaseWithNotes[];
  releaseTimestamp?: Timestamp;
  remediationNotPossible?: boolean;
  repoName?: string;
  minimumConfidence?: MergeConfidence | undefined;
  sourceDirectory?: string;
  sourceRepoSlug?: string;

  toLowerCase?: boolean;

  updatedPackageFiles?: FileChange[];
  updatedArtifacts?: FileChange[];

  logJSON?: ChangeLogResult | null;

  hasReleaseNotes?: boolean;
  homepage?: string;

  changelogContent?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  minimumGroupSize?: number;
  releaseNotesSummaryTitle?: string;
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

export type BranchResult =
  | 'already-existed'
  | 'automerged'
  | 'done'
  | 'error'
  | 'needs-approval'
  | 'needs-pr-approval'
  | 'not-scheduled'
  | 'no-work'
  | 'pending'
  | 'pr-created'
  | 'pr-edited'
  | 'pr-limit-reached'
  | 'commit-limit-reached'
  | 'branch-limit-reached'
  | 'rebase'
  | 'update-not-scheduled'
  | 'minimum-group-size-not-met';

export type CacheFingerprintMatchResult =
  | 'matched'
  | 'no-match'
  | 'no-fingerprint';

export interface BranchConfig
  extends BranchUpgradeConfig,
    LegacyAdminConfig,
    PlatformPrOptions {
  automergeComment?: string;
  automergedPreviously?: boolean;
  baseBranch: string;
  branchAutomergeFailureMessage?: string;

  /** ??? never set
   * @deprecated never set
   */
  committedFiles?: unknown;
  confidenceStatus?: BranchStatus;

  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardAllPending?: boolean;
  dependencyDashboardAllRateLimited?: boolean;
  dependencyDashboardAllAwaitingSchedule?: boolean;

  errors?: ValidationMessage[];
  forcePr?: boolean;
  hasTypes?: boolean;
  isModified?: boolean;
  isScheduledNow?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  dependencyDashboardPrApproval?: boolean;
  releaseTimestamp?: Timestamp;
  forceCommit?: boolean;
  rebaseRequested?: boolean;
  result?: BranchResult;
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
  prBlockedBy?: PrBlockedBy;
  prNo?: number;
  stabilityStatus?: BranchStatus;
  stopUpdating?: boolean;
  isConflicted?: boolean;
  commitFingerprint?: string;
  cacheFingerprintMatch?: CacheFingerprintMatchResult;
  prNotPendingHours?: number;
}

export interface BranchMetadata {
  branchName: string;
  branchSha?: string | null;
  baseBranch?: string;
  baseBranchSha?: string | null;
  automerge?: boolean;
  isModified?: boolean;
  isPristine?: boolean;
}

export interface BaseBranchMetadata {
  branchName: string;
  sha: string;
}

export interface BranchSummary {
  baseBranches: BaseBranchMetadata[];
  branches: BranchMetadata[];
  cacheModified?: boolean;
  defaultBranch?: string;
  inactiveBranches: string[];
}

export interface WorkerExtractConfig extends ExtractConfig {
  manager: string;
  fileList: string[];
  managerFilePatterns?: string[];
  includePaths?: string[];
  ignorePaths?: string[];
  enabled?: boolean;
}

export interface DepWarnings {
  warnings: string[];
  warningFiles: string[];
}

export interface SelectAllConfig extends RenovateConfig {
  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardAllPending?: boolean;
  dependencyDashboardAllRateLimited?: boolean;
  dependencyDashboardAllAwaitingSchedule?: boolean;
}

export interface UpgradeFingerprintConfig {
  autoReplaceStringTemplate?: string;
  currentDigest?: string;
  currentValue?: string;
  currentVersion?: string;
  datasource?: string;
  depName?: string;
  lockFile?: string;
  lockedVersion?: string;
  manager?: string | null;
  newName?: string;
  newDigest?: string;
  newValue?: string;
  newVersion?: string;
  packageFile?: string;
  replaceString?: string;
}

export interface ExtractResult {
  extractionFingerprints: Record<string, string | undefined>;
  packageFiles: Record<string, PackageFile[]>;
}
