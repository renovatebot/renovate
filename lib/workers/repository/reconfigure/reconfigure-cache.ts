import { logger } from '../../../logger/index.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { ExtractResult } from '../process/extract-update.ts';

export function setReconfigureBranchCache(
  reconfigureBranchSha: string,
  isConfigValid: boolean,
  extractResult?: ExtractResult,
): void {
  const cache = getCache();
  const reconfigureBranchCache = {
    reconfigureBranchSha,
    isConfigValid,
    ...(extractResult && { extractResult }),
  };
  if (cache.reconfigureBranchCache) {
    logger.debug({ reconfigureBranchCache }, 'Update reconfigure branch cache');
  } else {
    logger.debug({ reconfigureBranchCache }, 'Create reconfigure branch cache');
  }
  cache.reconfigureBranchCache = reconfigureBranchCache;
}

export function deleteReconfigureBranchCache(): void {
  const cache = getCache();

  if (cache?.reconfigureBranchCache) {
    logger.debug('Delete reconfigure branch cache');
    delete cache.reconfigureBranchCache;
  }
}
