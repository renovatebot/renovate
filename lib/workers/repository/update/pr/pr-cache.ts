import { logger } from '../../../../logger';
import { getCache } from '../../../../util/cache/repository';
import type { PrCache } from '../../../../util/cache/repository/types';

export function getPrCache(branchName: string): PrCache | null {
  logger.debug(`getPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName
  );

  if (!branch?.prCache) {
    return null;
  }

  return branch.prCache;
}

// store the time a PR was last updated
export function setPrCache(
  branchName: string,
  fingerprint: string,
  prModified: boolean
): void {
  logger.debug(`setPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName
  );

  if (!branch) {
    logger.debug(`setPrCache(): Branch cache not present`);
    return;
  }

  const lastEdited = branch.prCache?.lastEdited;
  branch.prCache = {
    fingerprint,
    // update time when creating new cache or when pr was modified
    lastEdited:
      lastEdited && !prModified ? lastEdited : new Date().toISOString(),
  };
}
