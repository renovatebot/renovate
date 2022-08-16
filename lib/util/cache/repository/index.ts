import { NullRepositoryCache } from './impl/null-repository-cache';
import type { RepoCache, RepoCacheData } from './types';

// This will be overwritten with initRepoCache()
// Used primarily as a placeholder and for testing
let repoCache: RepoCache = new NullRepositoryCache();

export function resetCache(): void {
  setCache(new NullRepositoryCache());
}

export function setCache(cache: RepoCache): void {
  repoCache = cache;
}

export function getCache(): RepoCacheData {
  return repoCache.getData();
}

export async function saveCache(): Promise<void> {
  await repoCache.save();
}
