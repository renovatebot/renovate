import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputCacheFile, readCacheFile } from '../../../fs';
import { RepoCacheBase } from './base';

export class LocalRepoCache extends RepoCacheBase {
  constructor(private platform: string, repository: string) {
    super(repository);
  }

  public getCacheFileName(): string {
    const cacheDir = GlobalConfig.get('cacheDir');
    const repoCachePath = '/renovate/repository/';
    const platform = this.platform;
    const fileName = `${this.repository}.json`;
    return upath.join(cacheDir, repoCachePath, platform, fileName);
  }

  protected async readFromCache(): Promise<string | undefined> {
    const cacheFileName = this.getCacheFileName();
    try {
      return await readCacheFile(cacheFileName, 'utf8');
    } catch (err) {
      logger.debug({ cacheFileName }, 'Repository cache not found');
      return undefined;
    }
  }

  protected async writeToCache(data: string): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    return await outputCacheFile(cacheFileName, data);
  }
}
