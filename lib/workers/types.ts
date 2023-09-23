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
  ExtractConfig,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../modules/manager/types';
import type { PlatformPrOptions } from '../modules/platform/types';
import type { FileChange } from '../util/git/types';
import type { MergeConfidence } from '../util/merge-confidence/types';
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
  depIndex?: number;

  displayPending?: string;
  excludeCommitPaths?: string[];
  githubName?: string;
  group?: GroupConfig;
  groupName?: string;
  groupSlug?: string;
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
  prTitleStrict?: boolean;
  prettyNewMajor?: string;
  prettyNewVersion?: string;
  releases?: ReleaseWithNotes[];
  releaseTimestamp?: string;
  repoName?: string;
  minimumConfidence?: MergeConfidence | undefined;
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
  | 'update-not-scheduled';

export interface BranchConfig
  extends BranchUpgradeConfig,
    LegacyAdminConfig,
    PlatformPrOptions {
  automergeComment?: string;
  automergeType?: string;
  automergedPreviously?: boolean;
  baseBranch: string;
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
  commitFingerprint?: string;
  skipBranchUpdate?: boolean;
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
  fileMatch?: string[];
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
