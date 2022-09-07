import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function getCachedBehindBaseResult(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string
): boolean | null {
  const cache = getCache();
  const { branches = [] } = cache;
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (
    branch &&
    branch.baseBranchName === baseBranchName &&
    branch.baseBranchSha === baseBranchSha &&
    branch.sha === branchSha &&
    branch.isBehindBaseBranch !== undefined
  ) {
    return branch.isBehindBaseBranch;
  }
  return null;
}

export function setCachedBehindBaseResult(
  branchName: string,
  isBehind: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    branch = {
      branchName: branchName,
      sha: getBranchCommit(branchName),
    } as BranchCache;
    cache.branches.push(branch);
  }

  branch.isBehindBaseBranch = isBehind;
}
