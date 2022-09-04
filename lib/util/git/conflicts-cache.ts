import { logger } from '../../logger';
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
    branch.baseBranchSha === targetBranchSha &&
    branch.sha === sourceBranchSha &&
    branch.isConflicted !== undefined
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
      sha: sourceBranchSha,
      baseBranchSha: targetBranchSha,
    } as BranchCache;
    cache.branches?.push(branch);
  }

  if (branch.sha !== sourceBranchSha) {
    logger.warn('Invalid Cache. Branch sha mismatch');
  }

  if (branch.baseBranchSha !== targetBranchSha) {
    logger.warn('Invalid Cache. Base branch sha mismatch');
  }

  if (branch.baseBranchName !== targetBranchName) {
    logger.warn('Invalid Cache. Base branch name mismatch');
  }

  branch.isConflicted = isConflicted;
}
