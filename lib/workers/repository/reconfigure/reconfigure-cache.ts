import { logger } from '../../../logger';
import { getCache } from '../../../util/cache/repository';
import type { ExtractResult } from '../process/extract-update';

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
