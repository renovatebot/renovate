import type { RenovateConfig } from '../../../config/types';
import { CacheFactory } from './impl/cache-factory';
import { NullRepositoryCache } from './impl/null-repository-cache';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  resetCache();

  const { repository, repositoryCache, repositoryCacheType: type } = config;

  if (repositoryCache === 'disabled') {
    setCache(new NullRepositoryCache());
    return;
  }

  if (repositoryCache === 'enabled') {
    const cache = CacheFactory.get(repository!, type);
    await cache.load();
    setCache(cache);
    return;
  }

  if (repositoryCache === 'reset') {
    const cache = CacheFactory.get(repository!, type);
    await cache.save();
    setCache(cache);
    return;
  }
}
