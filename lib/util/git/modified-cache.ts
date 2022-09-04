import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

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
  branchSha: string,
  isModified: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  const { branches } = cache;
  let branch = branches?.find((branch) => branch.branchName === branchName);
  // if branch not present add it to cache
  if (!branch) {
    branch = { branchName: branchName, sha: branchSha } as BranchCache;
    branches.push(branch);
  }

  if (branch.sha !== branchSha) {
    logger.warn(
      'Invalid Cache.Cached branch SHA is different than current branch SHA'
    );
  }

  branch.isModified = isModified;
}
