import fs from 'fs-extra';
import type { RenovateConfig } from '../../../config/types';
import * as npmApi from '../../../modules/datasource/npm';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';
import { privateCacheDir } from '../../../util/fs';

export async function resetCaches(): Promise<void> {
  memCache.reset();
  repositoryCache.reset();
  await fs.remove(privateCacheDir());
  npmApi.resetMemCache();
}

export async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);
  await fs.ensureDir(privateCacheDir());
  npmApi.setNpmrc(config.npmrc);
}
