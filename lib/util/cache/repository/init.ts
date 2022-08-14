import type { RenovateConfig } from '../../../config/types';
import { RepositoryCacheImpl } from './impl/repository-cache-impl';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  resetCache();

  const { repository, repositoryCache, repositoryCacheType: type } = config;

  if (repositoryCache === 'disabled' || !repository) {
    return;
  }

  if (repositoryCache === 'enabled') {
    const cache = new RepositoryCacheImpl(repository, type);
    await cache.load();
    setCache(cache);
    return;
  }

  if (repositoryCache === 'reset') {
    const cache = new RepositoryCacheImpl(repository, type);
    await cache.save();
    setCache(cache);
    return;
  }
}
