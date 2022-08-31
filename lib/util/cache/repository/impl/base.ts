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
  isValidRev13,
} from '../common';
import type {
  RepoCache,
  RepoCacheData,
  RepoCacheRecord,
  RepoCacheRecordV10,
  RepoCacheRecordV11,
  RepoCacheRecordV12,
  RepoCacheRecordV13,
} from '../types';

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

export abstract class RepoCacheBase implements RepoCache {
  protected platform = GlobalConfig.get('platform')!;
  private oldHash: string | null = null;
  private data: RepoCacheData = {};

  protected constructor(
    protected readonly repository: string,
    protected readonly fingerprint: string
  ) {}

  protected abstract read(): Promise<string | null>;

  protected abstract write(data: RepoCacheRecord): Promise<void>;

  private restoreFromRev10(oldCache: RepoCacheRecordV10): void {
    delete oldCache.repository;
    delete oldCache.revision;
    this.data = oldCache;
  }

  private restoreFromRev11(oldCache: RepoCacheRecordV11): void {
    this.data = oldCache.data;
  }

  private async restoreFromRev12(oldCache: RepoCacheRecordV12): Promise<void> {
    const compressed = Buffer.from(oldCache.payload, 'base64');
    const uncompressed = await decompress(compressed);
    const jsonStr = uncompressed.toString('utf8');
    this.data = JSON.parse(jsonStr);
    this.oldHash = oldCache.hash;
  }

  private async restoreFromRev13(oldCache: RepoCacheRecordV13): Promise<void> {
    if (oldCache.fingerprint !== this.fingerprint) {
      logger.debug('Repository cache fingerprint is invalid');
      return;
    }
    await this.restoreFromRev12(oldCache);
  }

  async load(): Promise<void> {
    try {
      const rawOldCache = await this.read();
      if (!is.string(rawOldCache)) {
        logger.debug(
          `RepoCacheBase.load() - expecting data of type 'string' received '${typeof rawOldCache}' instead - skipping`
        );
        return;
      }
      const oldCache = JSON.parse(rawOldCache) as unknown;

      if (isValidRev13(oldCache)) {
        await this.restoreFromRev13(oldCache);
        logger.debug('Repository cache is restored from revision 13');
        return;
      }

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
    const jsonStr = JSON.stringify(this.data);
    const hash = await hasha.async(jsonStr);
    if (hash === this.oldHash) {
      return;
    }

    const revision = CACHE_REVISION;
    const repository = this.repository;
    const fingerprint = this.fingerprint;

    const compressedPayload = await compress(jsonStr);
    const payload = compressedPayload.toString('base64');

    await this.write({
      revision,
      repository,
      fingerprint,
      payload,
      hash,
    });
  }

  getData(): RepoCacheData {
    return this.data;
  }
}
