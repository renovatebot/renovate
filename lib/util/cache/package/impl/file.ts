import cacache from 'cacache';
import { DateTime } from 'luxon';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { encodeEntry } from '../codec.ts';
import type { LegacyEntry } from '../legacy.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

interface FileCacheMetadata {
  expiry?: unknown;
}

export class PackageCacheFile extends PackageCacheBase {
  static create(cacheDir: string): PackageCacheFile {
    const cacheFileName = upath.join(cacheDir, '/renovate/renovate-cache-v1');
    logger.debug(`Initializing Renovate internal cache into ${cacheFileName}`);
    return new PackageCacheFile(cacheFileName);
  }

  private readonly cacheFileName: string;

  private constructor(cacheFileName: string) {
    super();
    this.cacheFileName = cacheFileName;
  }

  private getKey(namespace: PackageCacheNamespace, key: string): string {
    return `${namespace}-${key}`;
  }

  override async destroy(): Promise<void> {
    logger.debug('Checking file package cache for expired items');
    let totalCount = 0;
    let deletedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    for await (const item of cacache.ls.stream(this.cacheFileName)) {
      try {
        totalCount += 1;
        const cacheEntry = item as unknown as cacache.CacheObject;
        if (hasFutureExpiry(cacheEntry.metadata)) {
          continue;
        }

        // Entries without native expiry metadata include legacy and foreign
        // entries. The sweep evicts them so future reads converge on envelopes.
        await cacache.rm.entry(this.cacheFileName, cacheEntry.key);
        await cacache.rm.content(this.cacheFileName, cacheEntry.integrity);
        deletedCount += 1;
      } catch (err) {
        logger.trace({ err }, 'Error cleaning up cache entry');
        errorCount += 1;
      }
    }
    if (errorCount > 0) {
      logger.debug(`Error count cleaning up cache: ${errorCount}`);
    }
    const durationMs = Date.now() - startTime;
    logger.debug(
      `Deleted ${deletedCount} of ${totalCount} file cached entries in ${durationMs}ms`,
    );
  }

  protected override async readRaw(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<Buffer | undefined> {
    const cacheKey = this.getKey(namespace, key);
    try {
      // TODO: Once legacy file entries are unsupported, use get.info first and
      // require valid future expiry metadata before reading content.
      const entry = await cacache.get(this.cacheFileName, cacheKey);
      if (hasExpiredMetadata(entry.metadata)) {
        // Do not call rm here: rm.entry only tombstones the index entry, which
        // would hide this item from the sweep and orphan its content file.
        return undefined;
      }

      return entry.data;
    } catch {
      return undefined;
    }
  }

  protected override async writeRaw(
    namespace: PackageCacheNamespace,
    key: string,
    data: Buffer,
    ttlSeconds: number,
  ): Promise<void> {
    await this.putEntry(
      this.getKey(namespace, key),
      data,
      Date.now() + ttlSeconds * 1000,
    );
  }

  protected override async rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace({ namespace, key }, 'Removing cache entry');
    await cacache.rm.entry(this.cacheFileName, this.getKey(namespace, key));
  }

  // TODO: Delete together with the legacy decoder once pre-envelope entries
  // have expired.
  protected override async upgradeLegacyEntry(
    namespace: PackageCacheNamespace,
    key: string,
    entry: LegacyEntry,
  ): Promise<void> {
    const { expiry } = entry;
    if (!expiry?.isValid) {
      return;
    }

    try {
      await this.putEntry(
        this.getKey(namespace, key),
        await encodeEntry(entry.value, DateTime.local()),
        expiry.toMillis(),
      );
    } catch (err) {
      logger.once.debug({ err }, 'Error while upgrading legacy cache entry');
    }
  }

  private async putEntry(
    cacheKey: string,
    data: Buffer,
    expiry: number,
  ): Promise<void> {
    await cacache.put(this.cacheFileName, cacheKey, data, {
      metadata: { expiry },
    });
  }
}

function getMetadataExpiry(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const { expiry } = metadata as FileCacheMetadata;
  return typeof expiry === 'number' ? expiry : undefined;
}

// TODO: Treat missing or invalid expiry metadata as expired in readRaw once
// legacy file entries are unsupported.
function hasExpiredMetadata(metadata: unknown): boolean {
  const expiry = getMetadataExpiry(metadata);
  return expiry !== undefined && Date.now() >= expiry;
}

function hasFutureExpiry(metadata: unknown): boolean {
  const expiry = getMetadataExpiry(metadata);
  return expiry !== undefined && Date.now() < expiry;
}
