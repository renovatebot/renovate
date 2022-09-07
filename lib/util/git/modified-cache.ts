import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function getCachedModifiedResult(
  branchName: string,
  branchSha: string
): boolean | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.sha !== branchSha || branch.isModified === undefined) {
    return null;
  }

  return branch.isModified;
}

export function setCachedModifiedResult(
  branchName: string,
  isModified: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  const { branches } = cache;
  let branch = branches?.find((branch) => branch.branchName === branchName);
  // if branch not present add it to cache
  if (!branch) {
    branch = {
      branchName: branchName,
      sha: getBranchCommit(branchName),
    } as BranchCache;
    branches.push(branch);
  }

  branch.isModified = isModified;
}
