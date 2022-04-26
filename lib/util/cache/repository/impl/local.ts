import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputFile, readFile } from '../../../fs';
import {
  CACHE_REVISION,
  isValidRev10,
  isValidRev11,
  isValidRev12,
} from '../common';
import type { RepoCacheRecord } from '../types';
import { RepoCacheBase } from './base';

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

export class LocalRepoCache extends RepoCacheBase {
  private oldHash: string | null = null;

  constructor(private platform: string, private repository: string) {
    super();
  }

  public getCacheFileName(): string {
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

      if (isValidRev12(oldCache, this.repository)) {
        const compressed = Buffer.from(oldCache.payload, 'base64');
        const uncompressed = await decompress(compressed);
        const jsonStr = uncompressed.toString('utf8');
        this.data = JSON.parse(jsonStr);
        this.oldHash = oldCache.hash;
        logger.debug('Repository cache is valid');
        return;
      }

      if (isValidRev11(oldCache, this.repository)) {
        this.data = oldCache.data;
        logger.debug('Repository cache is migrated from 11 revision');
        return;
      }

      if (isValidRev10(oldCache, this.repository)) {
        delete oldCache.repository;
        delete oldCache.revision;
        this.data = oldCache;
        logger.debug('Repository cache is migrated from 10 revision');
        return;
      }

      logger.debug('Repository cache is invalid');
    } catch (err) {
      logger.debug({ cacheFileName }, 'Repository cache not found');
    }
  }

  override async save(): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const revision = CACHE_REVISION;
    const repository = this.repository;
    const data = this.getData();
    const jsonStr = JSON.stringify(data);
    const hash = await hasha.async(jsonStr, { algorithm: 'sha256' });
    if (hash !== this.oldHash) {
      const compressed = await compress(jsonStr);
      const payload = compressed.toString('base64');
      const record: RepoCacheRecord = { revision, repository, payload, hash };
      await outputFile(cacheFileName, JSON.stringify(record));
    }
  }
}
