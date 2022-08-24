import { promisify } from 'util';
import zlib from 'zlib';
import is from '@sindresorhus/is';
import hasha from 'hasha';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { CACHE_REVISION, isValidCacheRecord } from '../common';
import type { RepoCache, RepoCacheData, RepoCacheRecord } from '../types';

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

      if (!isValidCacheRecord(oldCache)) {
        logger.debug('Repository cache is invalid');
        return;
      }

      if (oldCache.fingerprint !== this.fingerprint) {
        logger.debug('Repository cache fingerprint is invalid');
        return;
      }

      const compressedPayload = Buffer.from(oldCache.payload, 'base64');
      const uncompressedPayload = await decompress(compressedPayload);
      const jsonCacheData = uncompressedPayload.toString('utf8');
      this.data = JSON.parse(jsonCacheData);
      this.oldHash = oldCache.hash;

      logger.debug('Repository cache is restored from revision 1');
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
