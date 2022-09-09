import { getCache } from '../cache/repository';

export function getCachedConflictResult(
  targetBranchName: string,
  targetBranchSha: string,
  sourceBranchName: string,
  sourceBranchSha: string
): boolean | null {
  const cache = getCache();
  // temporary code to delete existing cache
  if (cache.gitConflicts) {
    delete cache.gitConflicts;
  }

  const branch = cache.branches?.find(
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
  const branch = cache.branches?.find((br) => br.branchName === branchName);

  if (!branch) {
    return;
  }

  branch.isConflicted = isConflicted;
}
