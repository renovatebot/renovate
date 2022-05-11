import { RepoCacheBase } from './impl/base';
import type { RepoCache, RepoCacheData } from './types';

let repoCache: RepoCache = new RepoCacheBase();

export function resetCache(): void {
  setCache(new RepoCacheBase());
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
