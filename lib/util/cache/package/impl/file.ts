import cacache from 'cacache';
import { DateTime } from 'luxon';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { compressToBase64, decompressFromBase64 } from '../../../compress.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

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

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    try {
      const entry = await cacache.get(
        this.cacheFileName,
        this.getKey(namespace, key),
      );
      const raw = entry.data.toString();
      const cached = JSON.parse(raw);

      if (!cached) {
        return undefined;
      }

      const expiry = DateTime.fromISO(cached.expiry);
      if (!expiry.isValid || DateTime.local() >= expiry) {
        await this.rm(namespace, key);
        return undefined;
      }

      logger.trace({ namespace, key }, 'Returning cached value');

      if (!cached.compress) {
        return cached.value;
      }

      const json = await decompressFromBase64(cached.value);
      return JSON.parse(json);
    } catch {
      logger.trace({ namespace, key }, 'Cache miss');
    }
    return undefined;
  }

  override async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    logger.trace({ namespace, key, hardTtlMinutes }, 'Saving cached value');
    const serialized = JSON.stringify(value);
    const compressedValue = await compressToBase64(serialized);
    const expiry = DateTime.local().plus({ minutes: hardTtlMinutes });
    const payload = JSON.stringify({
      compress: true,
      value: compressedValue,
      expiry,
    });
    await cacache.put(this.cacheFileName, this.getKey(namespace, key), payload);
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
        const entry = await cacache.get(this.cacheFileName, cacheEntry.key);
        let cached: { expiry?: string } | undefined;
        try {
          const raw = entry.data.toString();
          cached = JSON.parse(raw);
        } catch {
          logger.debug('Error parsing cached value - deleting');
        }

        if (cached) {
          if (!cached.expiry) {
            continue;
          }
          const expiry = DateTime.fromISO(cached.expiry);
          if (expiry.isValid && DateTime.local() <= expiry) {
            continue;
          }
        }

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

  private async rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace({ namespace, key }, 'Removing cache entry');
    await cacache.rm.entry(this.cacheFileName, this.getKey(namespace, key));
  }
}
