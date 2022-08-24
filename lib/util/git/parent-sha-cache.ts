import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedBranchParentShaResult(
  branchName: string,
  branchSha: string | null
): string | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.parentSha && branchSha === branch?.sha) {
    return branch.parentSha;
  }

  return null;
}

export function setCachedBranchParentShaResult(
  branchName: string,
  parentSha: string
): void {
  const cache = getCache();
  cache.branches ??= [];

  let branch = cache.branches.find(
    (branch) => branch.branchName === branchName
  );
  if (!branch) {
    branch = {
      branchName: branchName,
    } as BranchCache;
    cache.branches.push(branch);
  }
  branch.parentSha = parentSha;
}
