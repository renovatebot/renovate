import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { RepositoryCacheImpl } from './impl/repository-cache-impl';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  resetCache();

  const { platform } = GlobalConfig.get();
  const { repository, repositoryCache, repositoryCacheType: type } = config;

  if (repositoryCache === 'disabled' || !platform || !repository) {
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
