import fs from 'fs-extra';
import * as npmApi from '../../../modules/datasource/npm';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';
import { initRepoCache } from '../../../util/cache/repository/init';
import { privateCacheDir } from '../../../util/fs';
import type { WorkerPlatformConfig } from './apis';

export async function resetCaches(): Promise<void> {
  memCache.reset();
  repositoryCache.resetCache();
  await fs.remove(privateCacheDir());
}

export async function initializeCaches(
  config: WorkerPlatformConfig,
): Promise<void> {
  memCache.init();
  await initRepoCache(config);
  await fs.ensureDir(privateCacheDir());
  npmApi.setNpmrc();
  npmApi.setNpmrc(config.npmrc);
}
