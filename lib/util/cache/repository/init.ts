import { CacheFactory } from './impl/cache-factory';
import { RepoCacheNull } from './impl/null';
import type { RepoCacheConfig } from './types';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RepoCacheConfig): Promise<void> {
  resetCache();

  const {
    repository,
    repositoryCache,
    repositoryCacheType: type = 'local',
    repoFingerprint,
  } = config;

  if (repositoryCache === 'disabled') {
    setCache(new RepoCacheNull());
    return;
  }

  if (repositoryCache === 'enabled') {
    const cache = CacheFactory.get(repository!, repoFingerprint, type);
    await cache.load();
    setCache(cache);
    return;
  }

  if (repositoryCache === 'reset') {
    const cache = CacheFactory.get(repository!, repoFingerprint, type);
    await cache.save();
    setCache(cache);
    return;
  }
}
