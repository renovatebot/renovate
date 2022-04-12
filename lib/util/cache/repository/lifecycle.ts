import { platform } from '../../../modules/platform';
import { fetchRepoCacheKey, pushRepoCache } from '../../git';
import type { Cache } from './types';

export async function fetch(): Promise<Cache | null> {
  const repoCacheKey = await fetchRepoCacheKey();
  if (repoCacheKey) {
    const repoCache = await platform.fetchRepoCache?.(repoCacheKey);
    if (repoCache) {
      return repoCache;
    }
  }
  return null;
}

export async function push(cache: Cache): Promise<void> {
  await pushRepoCache(cache);
}
