import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import { getBranchCommit } from '.';

export function getCachedConflictResult(
  branchName: string,
  baseBranch: string
): boolean | null {
  const cache = getCache();
  if (!cache.gitConflicts) {
    delete cache.gitConflicts;
  }

  const branch = cache?.branches?.find((br) => br.branchName === branchName);
  if (branch) {
    const branchSha = getBranchCommit(branchName);
    const baseBranchSha = getBranchCommit(baseBranch);
    if (
      branch.baseBranchSha === baseBranchSha &&
      branch.sha === branchSha &&
      branch.isConflicted
    ) {
      return branch.isConflicted;
    }
  }

  return null;
}

export function setCachedConflictResult(
  branchName: string,
  isConflicted: boolean
): void {
  const cache = getCache();
  const branch = cache?.branches?.find((br) => br.branchName === branchName);

  if (!branch) {
    logger.debug(`Branch cache not present for ${branchName}`);
    return;
  }

  branch.isConflicted = isConflicted;
}
