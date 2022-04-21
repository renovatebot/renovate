import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputFile, readFile } from '../../../fs';
import {
  CACHE_REVISION,
  canBeMigratedToV11,
  isValidCacheRecord,
} from '../common';
import type { RepoCacheRecord } from '../types';
import { RepoCacheBase } from './base';

export class LocalRepoCache extends RepoCacheBase {
  constructor(private platform: string, private repository: string) {
    super();
  }

  private getCacheFileName(): string {
    const cacheDir = GlobalConfig.get('cacheDir');
    const repoCachePath = '/renovate/repository/';
    const platform = this.platform;
    const fileName = `${this.repository}.json`;
    return upath.join(cacheDir, repoCachePath, platform, fileName);
  }

  override async load(): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    try {
      const cacheFileName = this.getCacheFileName();
      const rawCache = await readFile(cacheFileName, 'utf8');
      const oldCache = JSON.parse(rawCache);
      if (isValidCacheRecord(oldCache, this.repository)) {
        this.data = oldCache.data;
        logger.debug('Repository cache is valid');
      } else if (canBeMigratedToV11(oldCache, this.repository)) {
        delete oldCache.repository;
        delete oldCache.revision;
        this.data = oldCache;
        logger.debug('Repository cache is migrated');
      } else {
        logger.debug('Repository cache is invalid');
      }
    } catch (err) {
      logger.debug({ cacheFileName }, 'Repository cache not found');
    }
  }

  override async save(): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const revision = CACHE_REVISION;
    const repository = this.repository;
    const data = this.getData();
    const record: RepoCacheRecord = { revision, repository, data };
    await outputFile(cacheFileName, JSON.stringify(record));
  }
}
