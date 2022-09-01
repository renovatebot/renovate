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
  cache.branches ??= [];
  const branch = cache.branches.find(
    (br) => br.branchName === sourceBranchName
  );

  if (
    branch?.baseBranchName === targetBranchName &&
    branch?.baseBranchSha === targetBranchSha &&
    branch?.sha === sourceBranchSha
  ) {
    return branch.isConflicted;
  }

  return null;
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
  let branch = cache.branches.find((br) => br.branchName === sourceBranchName);

  if (!branch) {
    branch = {
      branchName: sourceBranchName,
      baseBranchName: targetBranchName,
    } as BranchCache;
    cache.branches?.push(branch);
  }

  if (branch.baseBranchSha !== targetBranchSha) {
    branch.baseBranchSha = targetBranchSha;
  }

  if (branch.sha !== sourceBranchSha) {
    branch.sha = sourceBranchSha;
  }

  branch.isConflicted = isConflicted;
}
