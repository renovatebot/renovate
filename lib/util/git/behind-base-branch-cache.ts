import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedBehindBaseResult(branchName: string): boolean | null {
  const cache = getCache();
  const { branches = [] } = cache;
  const branch = branches?.find((branch) => branch.branchName === branchName);
  if (!branch || branch.isBehindBaseBranch === undefined) {
    return null;
  }

  return branch.isBehindBaseBranch;
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
    } as BranchCache;
    cache.branches.push(branch);
  }

  branch.isBehindBaseBranch = isBehind;
}
