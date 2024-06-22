import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { RepoCacheNull } from './impl/null';
import type { RepoCache, RepoCacheData } from './types';

// This will be overwritten with initRepoCache()
// Used primarily as a placeholder and for testing
let repoCache: RepoCache = new RepoCacheNull();

export function resetCache(): void {
  setCache(new RepoCacheNull());
}

export function setCache(cache: RepoCache): void {
  repoCache = cache;
}

export function getCache(): RepoCacheData {
  return repoCache.getData();
}

export async function saveCache(): Promise<void> {
  if (GlobalConfig.get('dryRun')) {
    logger.info(`DRY-RUN: Would save repository cache.`);
  } else {
    await repoCache.save();
  }
}

export function isCacheModified(): boolean | undefined {
  return repoCache.isModified();
}
