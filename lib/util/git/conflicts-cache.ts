import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedConflictResult(
  targetBranchName: string,
  targetBranchSha: string,
  sourceBranchName: string,
  sourceBranchSha: string
): boolean | null {
  const cache = getCache();
  if (cache.gitConflicts) {
    delete cache.gitConflicts;
  }

  const branch = cache.branches?.find(
    (br) => br.branchName === sourceBranchName
  );

  if (branch?.baseBranchSha !== targetBranchSha) {
    return null;
  }

  if (branch?.sha !== sourceBranchSha) {
    return null;
  }

  return branch.isConflicted;
}

export function setCachedConflictResult(
  targetBranchName: string,
  targetBranchSha: string,
  sourceBranchName: string,
  sourceBranchSha: string,
  isConflicted: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches?.find((br) => br.branchName === sourceBranchName);

  if (!branch) {
    branch = {
      branchName: sourceBranchName,
      baseBranchName: targetBranchName,
    } as BranchCache;
    cache.branches?.push(branch);
  }

  if (!branch?.baseBranchSha || branch?.baseBranchSha !== targetBranchSha) {
    branch.baseBranchSha = targetBranchSha;
  }
  if (!branch?.sha || branch?.sha !== sourceBranchSha) {
    branch.sha = sourceBranchSha;
    // invalidate cached branch-modified result
    branch.isModified = null;
  }

  branch.isConflicted = isConflicted;
}
