import type { BranchResult, PrBlockedBy } from '../../../types.ts';

export interface ProcessBranchResult {
  branchExists: boolean;
  updatesVerified?: boolean;
  prBlockedBy?: PrBlockedBy;
  prNo?: number;
  result: BranchResult;
  commitSha?: string | null;
}
