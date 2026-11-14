import type { FileChange } from '../../../../util/git/types.ts';
import type {
  BranchConfig,
  BranchResult,
  PrBlockedBy,
} from '../../../types.ts';

export interface ProcessBranchResult {
  branchExists: boolean;
  updatesVerified?: boolean;
  prBlockedBy?: PrBlockedBy;
  prNo?: number;
  result: BranchResult;
  commitSha?: string | null;
}

export interface PostUpdateOptionsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: NonNullable<BranchConfig['artifactErrors']>;
}
