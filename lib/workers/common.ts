import type { Merge } from 'type-fest';
import {
  GroupConfig,
  RenovateAdminConfig,
  RenovateConfig,
  RenovateSharedConfig,
  ValidationMessage,
} from '../config';
import { Release } from '../datasource';
import {
  ArtifactError,
  LookupUpdate,
  PackageDependency,
  PackageFile,
} from '../manager/common';
import { PlatformPrOptions } from '../platform';
import { File } from '../util/git';
import { ChangeLogResult } from './pr/changelog/common';

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
  currentVersion?: string;
  endpoint?: string;
  excludeCommitPaths?: string[];
  githubName?: string;
  group?: GroupConfig;

  groupName?: string;
  groupSlug?: string;
  language?: string;
  manager?: string;
  packageFile?: string;

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

export enum ProcessBranchResult {
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
  Rebase = 'rebase',
}

export interface BranchConfig
  extends BranchUpgradeConfig,
    RenovateAdminConfig,
    PlatformPrOptions {
  automergeComment?: string;
  automergeType?: string;
  baseBranch?: string;
  canBeUnpublished?: boolean;
  errors?: ValidationMessage[];
  hasTypes?: boolean;
  dependencyDashboardChecks?: Record<string, string>;
  releaseTimestamp?: string;
  forceCommit?: boolean;
  rebaseRequested?: boolean;

  res?: ProcessBranchResult;
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
}
