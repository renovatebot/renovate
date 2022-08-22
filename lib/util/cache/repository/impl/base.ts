import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import {
  CACHE_REVISION,
  isValidRev10,
  isValidRev11,
  isValidRev12,
} from '../common';
import type { RepoCache, RepoCacheData, RepoCacheRecord } from '../types';

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

export abstract class RepoCacheBase implements RepoCache {
  protected platform = GlobalConfig.get('platform')!;
  private oldHash: string | null = null;
  private data: RepoCacheData = {};

  protected constructor(protected readonly repository: string) {}

  protected abstract read(): Promise<string | undefined>;

  protected abstract write(data: RepoCacheRecord): Promise<void>;

  async load(): Promise<void> {
    try {
      const oldCache = await this.read();

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
      await this.write({ revision, repository, payload, hash });
    }
  }

  getData(): RepoCacheData {
    return this.data;
  }
}
