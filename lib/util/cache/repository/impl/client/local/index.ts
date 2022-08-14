import upath from 'upath';
import { GlobalConfig } from '../../../../../../config/global';
import { logger } from '../../../../../../logger';
import { outputCacheFile, readCacheFile } from '../../../../../fs';
import type { CacheClient, RepoCacheRecord } from '../../../types';

export class LocalRepoCache implements CacheClient {
  constructor(private platform: string, private repository: string) {}

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
