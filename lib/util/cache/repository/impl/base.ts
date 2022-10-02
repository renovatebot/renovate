import { promisify } from 'util';
import zlib from 'zlib';
import is from '@sindresorhus/is';
import hasha from 'hasha';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import * as schema from '../../../schema';
import { safeStringify } from '../../../stringify';
import { CACHE_REVISION } from '../common';
import { RepoCacheRecord, RepoCacheV13 } from '../schemas';
import type { RepoCache, RepoCacheData } from '../types';

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

  private async restore(oldCache: RepoCacheRecord): Promise<void> {
    if (oldCache.fingerprint !== this.fingerprint) {
      logger.debug('Repository cache fingerprint is invalid');
      return;
    }
    const compressed = Buffer.from(oldCache.payload, 'base64');
    const uncompressed = await decompress(compressed);
    const jsonStr = uncompressed.toString('utf8');
    this.data = JSON.parse(jsonStr);
    this.oldHash = oldCache.hash;
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

      if (schema.match(RepoCacheV13, oldCache)) {
        await this.restore(oldCache);
        logger.debug('Repository cache is restored from revision 13');
        return;
      }

      logger.debug('Repository cache is invalid');
    } catch (err) {
      logger.debug({ err }, 'Error reading repository cache');
    }
  }

  async save(): Promise<void> {
    const jsonStr = safeStringify(this.data);
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

  isModified(): boolean | undefined {
    if (!this.oldHash) {
      return undefined;
    }
    const jsonStr = safeStringify(this.data);
    return hasha(jsonStr) !== this.oldHash;
  }
}
