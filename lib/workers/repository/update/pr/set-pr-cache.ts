import { logger } from '../../../../logger';
import { getCache } from '../../../../util/cache/repository';
import type { PrCache } from '../../../../util/cache/repository/types';

export function getPrCache(branchName: string): PrCache | null {
  logger.debug(`getPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName
  );

  if (branch?.prCache) {
    return branch.prCache;
  }

  return null;
}

// store the time a PR was last updated
export function setPrCache(branchName: string, fingerprint: string): void {
  logger.debug(`setPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName
  );

  if (!branch) {
    logger.debug(`setPrCache(): Branch cache not present`);
    return;
  }

  branch.prCache = {
    fingerprint,
    lastEdited: new Date(),
  };
}
