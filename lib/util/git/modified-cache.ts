import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import { getBranchCommit } from '.';

export function getCachedModifiedResult(branchName: string): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (branch) {
    const branchSha = getBranchCommit(branchName);
    if (branch.sha === branchSha && branch.isModified !== undefined) {
      return branch.isModified;
    }
  }

  return null;
}

export function setCachedModifiedResult(
  branchName: string,
  isModified: boolean
): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    logger.debug(`Branch cache not present for ${branchName}`);
    return;
  }

  branch.isModified = isModified;
}
