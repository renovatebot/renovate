import { GlobalConfig } from '../../../config/global.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { CacheFactory } from './impl/cache-factory.ts';
import { RepoCacheNull } from './impl/null.ts';
import { resetCache, setCache } from './index.ts';
import type { RepoCacheConfig } from './types.ts';

/**
 * Extracted to separate file in order to avoid circular module dependencies.
 */
export async function initRepoCache(config: RepoCacheConfig): Promise<void> {
  resetCache();

  const { repository, repoFingerprint } = config;
  const { state, type } = GlobalConfig.get('repositoryCache');

  if (state === 'disabled') {
    setCache(new RepoCacheNull());
    return;
  }

  if (state === 'enabled') {
    const cache = CacheFactory.get(repository!, repoFingerprint, type!);
    await instrument('load RepoCache', () => cache.load());
    setCache(cache);
    return;
  }

  if (state === 'reset') {
    const cache = CacheFactory.get(repository!, repoFingerprint, type!);
    await instrument('save RepoCache', () => cache.save());
    setCache(cache);
    return;
  }
}
