import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputCacheFile, readCacheFile } from '../../../fs';
import type { RepoCacheRecord } from '../types';
import { RepoCacheBase } from './base';

export class RepoCacheLocal extends RepoCacheBase {
  constructor(repository: string) {
    super(repository);
  }

  protected async read(): Promise<string | undefined> {
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

  protected async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    await outputCacheFile(cacheFileName, JSON.stringify(data));
  }

  private getCacheFileName(): string {
    const cacheDir = GlobalConfig.get('cacheDir');
    const repoCachePath = '/renovate/repository/';
    const platform = this.platform;
    const fileName = `${this.repository}.json`;
    return upath.join(cacheDir, repoCachePath, platform, fileName);
  }
}
