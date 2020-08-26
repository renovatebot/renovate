import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';

export async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);
  const cache = repositoryCache.getCache();
  cache.init = cache.init || {};
}

export function getResolvedConfig(
  defaultBranchSha: string
): RenovateConfig | null {
  if (!defaultBranchSha) {
    logger.trace('No defaultBranchSha, so no cached config possible');
    return null;
  }
  const { resolvedConfig } = repositoryCache.getCache().init;
  if (!resolvedConfig) {
    logger.debug('No cache.init.resolvedConfig');
    return null;
  }
  if (defaultBranchSha === resolvedConfig.defaultBranchSha) {
    logger.debug({ defaultBranchSha }, 'Cached resolvedConfig is valid');
    return resolvedConfig;
  }
  logger.debug(
    {
      cachedSha: resolvedConfig.defaultBranchSha,
      defaultBranchSha,
    },
    'Cached resolvedConfig is out of date'
  );
  return null;
}

export function setResolvedConfig(config: RenovateConfig): void {
  const cache = repositoryCache.getCache();
  cache.init.resolvedConfig = config;
}
