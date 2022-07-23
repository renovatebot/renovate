import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { LocalRepoCache } from './impl/local';
import { RedisRepoCache, initRedisClient } from './impl/redis';
import { resetCache, setCache } from '.';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RenovateConfig): Promise<void> {
  resetCache();

  const { platform } = GlobalConfig.get();
  const { repository, repositoryCache } = config;

  if (
    repositoryCache === 'disabled' ||
    repositoryCache === undefined ||
    !platform ||
    !repository
  ) {
    return;
  }

  if (repositoryCache?.startsWith('redis://')) {
    await initRedisClient(repositoryCache);
    setCache(new RedisRepoCache(platform, repository));
    return;
  }

  const cache = new LocalRepoCache(platform, repository);

  if (repositoryCache === 'local' || repositoryCache === 'enabled') {
    await cache.load();
    setCache(cache);
    return;
  }

  if (repositoryCache === 'reset') {
    await cache.save();
    setCache(cache);
    return;
  }

  throw new Error(`Unexpected repositoryCache value: ${repositoryCache}`);
}
