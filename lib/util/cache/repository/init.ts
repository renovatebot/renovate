import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { LocalRepoCache } from './impl/local';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  resetCache();

  const { platform } = GlobalConfig.get();
  const { repository, repositoryCache } = config;

  if (repositoryCache === 'disabled' || !platform || !repository) {
    return;
  }

  if (repositoryCache === 'enabled') {
    const localCache = new LocalRepoCache(platform, repository);
    await localCache.load();
    setCache(localCache);
    return;
  }

  if (repositoryCache === 'reset') {
    const localCache = new LocalRepoCache(platform, repository);
    await localCache.save();
    setCache(localCache);
    return;
  }
}
