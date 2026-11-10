import * as npmApi from '../../../modules/datasource/npm/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as repositoryCache from '../../../util/cache/repository/index.ts';
import { initRepoCache } from '../../../util/cache/repository/init.ts';
import { ensureDir, privateCacheDir, rmCache } from '../../../util/fs/index.ts';
import type { WorkerPlatformConfig } from './apis.ts';

export async function resetCaches(): Promise<void> {
  memCache.reset();
  repositoryCache.resetCache();
  await rmCache(privateCacheDir());
}

export async function initializeCaches(
  config: WorkerPlatformConfig,
): Promise<void> {
  await initRepoCache(config);
  await ensureDir(privateCacheDir());
  npmApi.setNpmrc();
  npmApi.setNpmrc(config.npmrc);
}
