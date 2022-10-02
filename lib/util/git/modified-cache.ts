import { logger } from '../../logger';
import { getCache } from '../cache/repository';

export function getCachedModifiedResult(
  branchName: string,
  branchSha: string
): boolean | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.sha === branchSha && branch.isModified !== undefined) {
    return branch.isModified;
  }

  return null;
}

export function setCachedModifiedResult(
  branchName: string,
  branchSha: string,
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

  if (!branch.sha || branch.sha !== branchSha) {
    branch.sha = branchSha;
  }

  branch.isModified = isModified;
}
