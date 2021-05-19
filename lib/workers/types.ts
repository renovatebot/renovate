import type { Merge } from 'type-fest';
import type {
  GroupConfig,
  LegacyAdminConfig,
  RenovateConfig,
  RenovateSharedConfig,
  ValidationMessage,
} from '../config/types';
import type { Release } from '../datasource/types';
import type {
  ArtifactError,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../manager/types';
import type { PlatformPrOptions } from '../platform/types';
import type { File } from '../util/git';
import type { ChangeLogResult } from './pr/changelog/types';

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
  endpoint?: string;
  excludeCommitPaths?: string[];
  githubName?: string;
  group?: GroupConfig;
  constraints?: Record<string, string>;
  groupName?: string;
  groupSlug?: string;
  language?: string;
  manager?: string;
  packageFile?: string;
  lockFile?: string;
  reuseExistingBranch?: boolean;
  prHeader?: string;
  prFooter?: string;
  prBodyNotes?: string[];
  prBodyTemplate?: string;
  prPriority?: number;
  prTitle?: string;
  releases?: Release[];
  releaseTimestamp?: string;
  repoName?: string;

  sourceDirectory?: string;

  updatedPackageFiles?: File[];
  updatedArtifacts?: File[];

  logJSON?: ChangeLogResult;

  homepage?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  sourceUrl?: string;
}

export enum PrResult {
  AwaitingApproval = 'AwaitingApproval',
  AwaitingGreenBranch = 'AwaitingGreenBranch',
  AwaitingNotPending = 'AwaitingNotPending',
  BlockedByBranchAutomerge = 'BlockedByBranchAutomerge',
  Created = 'Created',
  Error = 'Error',
  ErrorAlreadyExists = 'ErrorAlreadyExists',
  NotUpdated = 'NotUpdated',
  Updated = 'Updated',
  LimitReached = 'LimitReached',
}

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
}
