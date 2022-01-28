import { getCache } from '../cache/repository';

export function getCachedConflictResult(
  targetBranchName: string,
  targetBranchSha: string,
  sourceBranchName: string,
  sourceBranchSha: string
): boolean | null {
  const { gitConflicts } = getCache();
  if (!gitConflicts) {
    return null;
  }

  const targetBranchConflicts = gitConflicts[targetBranchName];
  if (targetBranchConflicts?.targetBranchSha !== targetBranchSha) {
    return null;
  }

  const sourceBranchConflict =
    targetBranchConflicts.sourceBranches[sourceBranchName];
  if (sourceBranchConflict?.sourceBranchSha !== sourceBranchSha) {
    return null;
  }

  return sourceBranchConflict.isConflicted;
}

export function setCachedConflictResult(
  targetBranchName: string,
  targetBranchSha: string,
  sourceBranchName: string,
  sourceBranchSha: string,
  isConflicted: boolean
): void {
  const cache = getCache();
  cache.gitConflicts ??= {};
  const { gitConflicts } = cache;

  let targetBranchConflicts = gitConflicts[targetBranchName];
  if (targetBranchConflicts?.targetBranchSha !== targetBranchSha) {
    gitConflicts[targetBranchName] = {
      targetBranchSha,
      sourceBranches: {},
    };
    targetBranchConflicts = gitConflicts[targetBranchName];
  }

  const sourceBranchConflict =
    targetBranchConflicts.sourceBranches[sourceBranchName];
  if (sourceBranchConflict?.sourceBranchSha !== sourceBranchSha) {
    targetBranchConflicts.sourceBranches[sourceBranchName] = {
      sourceBranchSha,
      isConflicted,
    };
  }
}
