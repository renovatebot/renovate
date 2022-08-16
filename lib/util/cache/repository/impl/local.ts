import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputCacheFile, readCacheFile } from '../../../fs';
import type { RepoCacheRecord } from '../types';
import { RepositoryCacheBase } from './repository-cache-base';

export class LocalRepositoryCache extends RepositoryCacheBase {
  constructor(repository: string) {
    super(repository);
  }

  public getCacheFileName(): string {
    const cacheDir = GlobalConfig.get('cacheDir');
    const repoCachePath = '/renovate/repository/';
    const platform = this.platform;
    const fileName = `${this.repository}.json`;
    return upath.join(cacheDir, repoCachePath, platform, fileName);
  }

  async read(): Promise<string | undefined> {
    const cacheFileName = this.getCacheFileName();
    let data: string | undefined;
    try {
      const rawCache = await readCacheFile(cacheFileName, 'utf8');
      data = JSON.parse(rawCache);
    } catch (err) {
      logger.debug({ cacheFileName }, 'Repository local cache not found');
      throw err;
    }
    return data;
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    await outputCacheFile(cacheFileName, JSON.stringify(data));
  }
}
