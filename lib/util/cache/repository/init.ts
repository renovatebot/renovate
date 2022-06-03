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
  if (platform && config.repository && config.repositoryCache === 'enabled') {
    const localCache = new LocalRepoCache(platform, config.repository);
    await localCache.load();
    setCache(localCache);
  }
}
