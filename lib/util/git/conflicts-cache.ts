import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

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
    branch.baseBranchSha === targetBranchSha &&
    branch.sha === sourceBranchSha &&
    branch.isConflicted !== undefined
  ) {
    return branch.isConflicted;
  }

  return null;
}

export function setCachedConflictResult(
  branchName: string,
  isConflicted: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find((br) => br.branchName === branchName);

  if (!branch) {
    branch = {
      branchName: branchName,
      sha: getBranchCommit(branchName),
    } as BranchCache;
    cache.branches?.push(branch);
  }

  branch.isConflicted = isConflicted;
}
