import { logger } from '../../../logger';
import { getCache } from '../../../util/cache/repository';

export function setReconfigureBranchCache(
  reconfigureBranchSha: string,
  configFileName: string,
  isConfigValid: boolean
): void {
  const cache = getCache();
  const reconfigureBranchCache = {
    reconfigureBranchSha,
    configFileName,
    isConfigValid,
  };
  if (cache.reconfigureBranchCache) {
    logger.debug({ reconfigureBranchCache }, 'Update Reconfigure Branch Cache');
  } else {
    logger.debug({ reconfigureBranchCache }, 'Create Reconfigure Branch Cache');
  }
  cache.reconfigureBranchCache = reconfigureBranchCache;
}

export function deleteReconfigureBranchCache(): void {
  const cache = getCache();

  if (cache?.reconfigureBranchCache) {
    logger.debug('Delete Reconfigure Branch Cache');
    delete cache.reconfigureBranchCache;
  }
}
