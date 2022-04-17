import type { RenovateConfig } from '../../../config/types';
import { LocalRepoCache } from './impl/local';
import { setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  if (
    config.platform &&
    config.repository &&
    config.repositoryCache === 'enabled'
  ) {
    const localCache = new LocalRepoCache(config.platform, config.repository);
    await localCache.load();
    setCache(localCache);
  }
}
