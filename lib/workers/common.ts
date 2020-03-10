import { Merge } from 'type-fest';
import { PackageDependency, ArtifactError } from '../manager/common';
import {
  RenovateSharedConfig,
  RenovateConfig,
  GroupConfig,
  RenovateAdminConfig,
  ValidationMessage,
} from '../config';
import { LookupUpdate } from './repository/process/lookup/common';
import { FileData, PlatformPrOptions } from '../platform';
import { Release } from '../datasource';

export interface BranchUpgradeConfig
  extends Merge<RenovateConfig, PackageDependency>,
    Partial<LookupUpdate>,
    RenovateSharedConfig {
  artifactErrors?: ArtifactError[];
  branchName: string;
  commitMessage?: string;
  currentDigest?: string;
  currentDigestShort?: string;
  currentValue?: string;
  currentVersion?: string;

  endpoint?: string;
  excludeCommitPaths?: string[];
  group?: GroupConfig;

  groupName?: string;
  groupSlug?: string;
  language?: string;
  manager?: string;
  packageFile?: string;

  parentBranch?: string;
  prBodyNotes?: string[];
  prPriority?: number;
  prTitle?: string;
  releases?: Release[];
  releaseTimestamp?: string;

  sourceDirectory?: string;
  updatedPackageFiles?: FileData[];
  updatedArtifacts?: FileData[];
}

export enum PrResult {
  AwaitingBranchAutomerge = 'AwaitingBranchAutomerge',
  AwaitingApproval = 'AwaitingApproval',
  AwaitingGreenBranch = 'AwaitingGreenBranch',
  AwaitingNotPending = 'AwaitingNotPending',
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
  automergeType?: string;
  baseBranch?: string;
  canBeUnpublished?: boolean;
  errors?: ValidationMessage[];
  hasTypes?: boolean;
  releaseTimestamp?: string;

  res?: ProcessBranchResult;
  upgrades: BranchUpgradeConfig[];
}
