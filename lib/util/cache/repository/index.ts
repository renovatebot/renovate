import { RepositoryCacheNullImpl } from './impl/repository-cache-null-impl';
import type { RepoCache, RepoCacheData } from './types';

// This will be overwritten with initRepoCache()
// Used primarily as a placeholder and for testing
let repoCache: RepoCache = new RepositoryCacheNullImpl();

export function resetCache(): void {
  setCache(new RepositoryCacheNullImpl());
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
