import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import type { RepositoryCacheType } from '../../../../config/types';
import { logger } from '../../../../logger';
import {
  CACHE_REVISION,
  isValidRev10,
  isValidRev11,
  isValidRev12,
} from '../common';
import type { CacheClient, RepoCache, RepoCacheData } from '../types';
import { CacheClientFactory } from './cache-client-factory';

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

export class RepositoryCacheImpl implements RepoCache {
  private cacheClient: CacheClient;
  private oldHash: string | null = null;
  private data: RepoCacheData = {};

  constructor(
    protected readonly repository: string,
    type: RepositoryCacheType = 'local'
  ) {
    this.cacheClient = CacheClientFactory.get(repository, type);
  }

  async load(): Promise<void> {
    try {
      const oldCache = await this.cacheClient.read();

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
      logger.debug('Error reading repository cache');
    }
  }

  async save(): Promise<void> {
    const revision = CACHE_REVISION;
    const repository = this.repository;
    const jsonStr = JSON.stringify(this.data);
    const hash = await hasha.async(jsonStr, { algorithm: 'sha256' });
    if (hash !== this.oldHash) {
      const compressed = await compress(jsonStr);
      const payload = compressed.toString('base64');
      await this.cacheClient.write({ revision, repository, payload, hash });
    }
  }

  getData(): RepoCacheData {
    return this.data;
  }
}
