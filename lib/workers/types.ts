import type { Merge } from 'type-fest';
import type {
  GroupConfig,
  LegacyAdminConfig,
  RegExManager,
  RenovateConfig,
  RenovateSharedConfig,
  ValidationMessage,
} from '../config/types';
import type { Release } from '../modules/datasource/types';
import type {
  ArtifactError,
  ExtractConfig,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../modules/manager/types';
import type { PlatformPrOptions } from '../modules/platform/types';
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
  prettyNewMajor?: string;
  prettyNewVersion?: string;
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
  branchFingerprint?: string;
  skipBranchUpdate?: boolean;
}

export interface WorkerExtractConfig extends ExtractConfig {
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

export interface DepWarnings {
  warnings: string[];
  warningFiles: string[];
}

export interface SelectAllConfig extends RenovateConfig {
  dependencyDashboardRebaseAllOpen?: boolean;
  dependencyDashboardAllPending?: boolean;
  dependencyDashboardAllRateLimited?: boolean;
}
