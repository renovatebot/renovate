import { logger } from '../../logger';
import { getCache } from '../cache/repository';

export function getCachedModifiedResult(
  branchName: string,
  branchSha: string | null,
): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName,
  );

  if (branch?.sha === branchSha && branch.isModified !== undefined) {
    return branch.isModified;
  }

  return null;
}

export function setCachedModifiedResult(
  branchName: string,
  isModified: boolean,
): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName,
  );

  if (!branch) {
    logger.debug(`setCachedModifiedResult(): Branch cache not present`);
    return;
  }

  branch.isModified = isModified;
}
