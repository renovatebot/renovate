import { MemoryRepoCache } from './impl/memory';
import type { RepoCache, RepoCacheData } from './types';

let repoCache: RepoCache = new MemoryRepoCache();

export function reset(): void {
  setCache(new MemoryRepoCache());
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
