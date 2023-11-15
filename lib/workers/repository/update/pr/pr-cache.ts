import { logger } from '../../../../logger';
import { getCache } from '../../../../util/cache/repository';
import type { PrCache } from '../../../../util/cache/repository/types';

export function getPrCache(branchName: string): PrCache | null {
  logger.debug(`getPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName,
  );

  const prCache = branch?.prCache;
  if (!prCache) {
    return null;
  }

  // istanbul ignore if
  if (prCache.fingerprint) {
    prCache.bodyFingerprint = prCache.fingerprint;
    delete prCache.fingerprint;
  }

  return prCache;
}

// store the time a PR was last updated
export function setPrCache(
  branchName: string,
  bodyFingerprint: string,
  prModified: boolean,
): void {
  logger.debug(`setPrCache()`);
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branchName === branch.branchName,
  );

  if (!branch) {
    logger.debug(`setPrCache(): Branch cache not present`);
    return;
  }

  const lastEdited = branch.prCache?.lastEdited;
  branch.prCache = {
    bodyFingerprint,
    // update time when creating new cache or when pr was modified
    lastEdited:
      lastEdited && !prModified ? lastEdited : new Date().toISOString(),
  };
}
