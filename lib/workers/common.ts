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
import { File, PlatformPrOptions } from '../platform';
import { ChangeLogResult } from './pr/changelog/common';
import { Merge } from 'type-fest';

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
}

export enum PrResult {
  AwaitingApproval = 'AwaitingApproval',
  AwaitingGreenBranch = 'AwaitingGreenBranch',
  AwaitingNotPending = 'AwaitingNotPending',
  BlockeddByBranchAutomerge = 'BlockeddByBranchAutomerge',
  Created = 'Created',
  Error = 'Error',
  ErrorAlreadyExists = 'ErrorAlreadyExists',
  NotUpdated = 'NotUpdated',
  Updated = 'Updated',
}

export type ProcessBranchResult =
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
  | 'pr-hourly-limit-reached'
  | 'rebase';

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
  masterIssueChecks?: Record<string, string>;
  releaseTimestamp?: string;
  forceCommit?: boolean;
  rebaseRequested?: boolean;

  res?: ProcessBranchResult;
  upgrades: BranchUpgradeConfig[];
  packageFiles?: Record<string, PackageFile[]>;
}
