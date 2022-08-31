import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function setBranchShas(
  branchName: string,
  baseBranchName: string,
  commitSha: string
): void {
  const cache = getCache();
  const baseBranchSha = getBranchCommit(baseBranchName);
  cache.branches ??= [];

  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    branch = {
      branchName: branchName,
      baseBranchName: baseBranchName,
    } as BranchCache;
    cache.branches.push(branch);
  }
  branch.sha = commitSha;
  branch.baseBranchSha = baseBranchSha;
  branch.parentSha = baseBranchSha;
  branch.isConflicted = false;
  branch.isModified = false;
}
