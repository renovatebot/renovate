import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { compressToBase64, decompressFromBase64 } from '../../../compress';
import { hash } from '../../../hash';
import { safeStringify } from '../../../stringify';
import { CACHE_REVISION } from '../common';
import { RepoCacheRecord, RepoCacheV13 } from '../schema';
import type { RepoCache, RepoCacheData } from '../types';

export abstract class RepoCacheBase implements RepoCache {
  protected platform = GlobalConfig.get('platform')!;
  private oldHash: string | null = null;
  private data: RepoCacheData = {};

  protected constructor(
    protected readonly repository: string,
    protected readonly fingerprint: string,
  ) {}

  protected abstract read(): Promise<string | null>;

  protected abstract write(data: RepoCacheRecord): Promise<void>;

  private static parseData(input: string): RepoCacheData {
    const data: RepoCacheData = JSON.parse(input);
    // istanbul ignore next
    if (data.branches) {
      for (const branch of data.branches) {
        if (branch.branchFingerprint) {
          branch.commitFingerprint = branch.branchFingerprint;
          delete branch.branchFingerprint;
        }
      }
    }
    return data;
  }

  private async restore(oldCache: RepoCacheRecord): Promise<void> {
    if (oldCache.fingerprint !== this.fingerprint) {
      logger.debug('Repository cache fingerprint is invalid');
      return;
    }
    const jsonStr = await decompressFromBase64(oldCache.payload);
    this.data = RepoCacheBase.parseData(jsonStr);
    this.oldHash = oldCache.hash;
  }

  async load(): Promise<void> {
    try {
      const oldCache = await this.read();
      if (!is.string(oldCache)) {
        logger.debug(
          `RepoCacheBase.load() - expecting data of type 'string' received '${typeof oldCache}' instead - skipping`,
        );
        return;
      }

      const cacheV13 = RepoCacheV13.safeParse(oldCache);
      if (cacheV13.success) {
        await this.restore(cacheV13.data);
        logger.debug('Repository cache is restored from revision 13');
        return;
      }

      logger.warn({ err: cacheV13.error }, 'Repository cache is invalid');
    } catch (err) /* istanbul ignore next: not easily testable */ {
      logger.debug({ err }, 'Error reading repository cache');
    }
  }

  async save(): Promise<void> {
    const jsonStr = safeStringify(this.data);
    const hashedJsonStr = hash(jsonStr);
    if (hashedJsonStr === this.oldHash) {
      return;
    }

    const revision = CACHE_REVISION;
    const repository = this.repository;
    const fingerprint = this.fingerprint;

    const payload = await compressToBase64(jsonStr);

    await this.write({
      revision,
      repository,
      fingerprint,
      payload,
      hash: hashedJsonStr,
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
    return hash(jsonStr) !== this.oldHash;
  }
}
