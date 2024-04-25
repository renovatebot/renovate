import { logger } from '../../../../logger';
import { cachePathExists, outputCacheFile, readCacheFile } from '../../../fs';
import { getLocalCacheFileName } from '../common';
import type { RepoCacheRecord } from '../schema';
import { RepoCacheBase } from './base';

export class RepoCacheLocal extends RepoCacheBase {
  constructor(repository: string, fingerprint: string) {
    super(repository, fingerprint);
  }

  protected async read(): Promise<string | null> {
    const cacheFileName = this.getCacheFileName();
    try {
      // suppress debug logs with errros
      if (!(await cachePathExists(cacheFileName))) {
        return null;
      }
      return await readCacheFile(cacheFileName, 'utf8');
    } catch (err) {
      logger.debug({ err, cacheFileName }, 'Repository local cache not found');
    }
    return null;
  }

  protected async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    await outputCacheFile(cacheFileName, JSON.stringify(data));
  }

  private getCacheFileName(): string {
    return getLocalCacheFileName(this.platform, this.repository);
  }
}
