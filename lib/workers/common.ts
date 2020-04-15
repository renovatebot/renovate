import { Merge } from 'type-fest';
import {
  PackageDependency,
  ArtifactError,
  LookupUpdate,
} from '../manager/common';
import {
  RenovateSharedConfig,
  RenovateConfig,
  GroupConfig,
  RenovateAdminConfig,
  ValidationMessage,
} from '../config';
import { File, PlatformPrOptions } from '../platform';
import { Release } from '../datasource';

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

  parentBranch?: string;
  prBanner?: string;
  prBodyNotes?: string[];
  prBodyTemplate?: string;
  prPriority?: number;
  prTitle?: string;
  releases?: Release[];

  releaseTimestamp?: string;

  sourceDirectory?: string;
  updatedPackageFiles?: File[];
  updatedArtifacts?: File[];
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

  res?: ProcessBranchResult;
  upgrades: BranchUpgradeConfig[];
}
