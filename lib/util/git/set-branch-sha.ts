import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function setBranchCommit(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string,
  branchFingerprint: string
): BranchCache {
  const cache = getCache();
  cache.branches ??= [];

  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    branch = {
      branchName: branchName,
      baseBranchName: baseBranchName,
    } as BranchCache;
    cache.branches.push(branch);
  }

  branch.sha = branchSha;
  branch.baseBranchSha = baseBranchSha;
  branch.isBehindBaseBranch = false;
  branch.isConflicted = false;
  branch.isModified = false;
  branch.branchFingerprint = branchFingerprint;
  branch.parentSha = baseBranchSha;

  return branch;
}
