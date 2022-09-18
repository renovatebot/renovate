import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function setBranchCommit(
  branchName: string,
  baseBranch: string,
  commitSha: string
): BranchCache {
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    branch = {
      branchName: branchName,
      baseBranch: baseBranch,
    } as BranchCache;
    cache.branches.push(branch);
  }

  const baseBranchSha = getBranchCommit(baseBranch);

  branch.sha = commitSha;
  branch.baseBranchSha = baseBranchSha;
  branch.isBehindBase = false;
  branch.isModified = false;
  branch.parentSha = baseBranchSha;

  return branch;
}
