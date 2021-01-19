import * as fs from 'fs-extra';
import { RenovateConfig } from '../../../config';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';
import { privateCacheDir } from '../../../util/fs';

export async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);

  await fs.remove(privateCacheDir());
  await fs.ensureDir(privateCacheDir());
}
