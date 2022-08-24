import { promisify } from 'util';
import zlib from 'zlib';
import is from '@sindresorhus/is';
import hasha from 'hasha';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import {
  CACHE_REVISION,
  isValidRev10,
  isValidRev11,
  isValidRev12,
} from '../common';
import type {
  RepoCache,
  RepoCacheData,
  RepoCacheRecord,
  RepoCacheRecordV10,
  RepoCacheRecordV11,
  RepoCacheRecordV12,
} from '../types';

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

export abstract class RepoCacheBase implements RepoCache {
  protected platform = GlobalConfig.get('platform')!;
  private oldHash: string | null = null;
  private data: RepoCacheData = {};

  protected constructor(protected readonly repository: string) {}

  protected abstract read(): Promise<string | null>;

  protected abstract write(data: RepoCacheRecord): Promise<void>;

  private async restoreFromRev12(oldCache: RepoCacheRecordV12): Promise<void> {
    const compressed = Buffer.from(oldCache.payload, 'base64');
    const uncompressed = await decompress(compressed);
    const jsonStr = uncompressed.toString('utf8');
    this.data = JSON.parse(jsonStr);
    this.oldHash = oldCache.hash;
  }

  private restoreFromRev11(oldCache: RepoCacheRecordV11): void {
    this.data = oldCache.data;
  }

  private restoreFromRev10(oldCache: RepoCacheRecordV10): void {
    delete oldCache.repository;
    delete oldCache.revision;
    this.data = oldCache;
  }

  async load(): Promise<void> {
    try {
      const data = await this.read();
      if (!is.string(data)) {
        logger.debug(
          `RepoCacheBase.load() - expecting data of type 'string' received '${typeof data}' instead - skipping`
        );
        return;
      }
      const oldCache = JSON.parse(data) as unknown;

      if (isValidRev12(oldCache, this.repository)) {
        await this.restoreFromRev12(oldCache);
        logger.debug('Repository cache is restored from revision 12');
        return;
      }

      if (isValidRev11(oldCache, this.repository)) {
        this.restoreFromRev11(oldCache);
        logger.debug('Repository cache is restored from revision 11');
        return;
      }

      if (isValidRev10(oldCache, this.repository)) {
        this.restoreFromRev10(oldCache);
        logger.debug('Repository cache is restored from revision 10');
        return;
      }

      logger.debug('Repository cache is invalid');
    } catch (err) {
      logger.debug({ err }, 'Error reading repository cache');
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
