import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import {
  CACHE_REVISION,
  canBeMigratedToV11,
  isValidCacheRecord,
} from '../common';
import type { RepoCache, RepoCacheData, RepoCacheRecord } from '../types';

export class LocalRepoCache implements RepoCache {
  private data: RepoCacheData = {};

  constructor(private platform: string, private repository: string) {}

  private getCacheFileName(): string {
    const cacheDir = GlobalConfig.get('cacheDir');
    const repoCachePath = '/renovate/repository/';
    const platform = this.platform;
    const fileName = `${this.repository}.json`;
    return upath.join(cacheDir, repoCachePath, platform, fileName);
  }

  async load(): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    try {
      const cacheFileName = this.getCacheFileName();
      const rawCache = await fs.readFile(cacheFileName, 'utf8');
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

  async save(): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const revision = CACHE_REVISION;
    const repository = this.repository;
    const data = this.getData();
    const record: RepoCacheRecord = { revision, repository, data };
    await fs.outputFile(cacheFileName, JSON.stringify(record));
  }

  getData(): RepoCacheData {
    this.data ??= {};
    return this.data;
  }
}
