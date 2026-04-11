import { isPlainObject } from '@sindresorhus/is';
import cacache from 'cacache';
import { DateTime } from 'luxon';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import {
  compressToBuffer,
  decompressFromBase64,
  decompressFromBuffer,
} from '../../../compress.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

const currentCacheFormat = 'br-json';
const currentCacheVersion = 2;

interface PackageCacheLegacyEntry {
  compress: true;
  expiry: string;
  value: string;
}

interface PackageCacheMetadata {
  expiry: string;
  format: typeof currentCacheFormat;
  version: typeof currentCacheVersion;
}

function parseCacheMetadata(value: unknown): PackageCacheMetadata | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const { expiry, format, version } = value;

  if (
    typeof expiry !== 'string' ||
    format !== currentCacheFormat ||
    version !== currentCacheVersion
  ) {
    return undefined;
  }

  return { expiry, format, version };
}

function parseLegacyCacheEntry(
  data: Buffer,
): PackageCacheLegacyEntry | undefined {
  const parsed: unknown = JSON.parse(data.toString());
  if (!isPlainObject(parsed)) {
    return undefined;
  }

  const { compress, expiry, value } = parsed;

  if (
    compress !== true ||
    typeof expiry !== 'string' ||
    typeof value !== 'string'
  ) {
    return undefined;
  }

  return {
    compress,
    expiry,
    value,
  };
}

async function deserializeCurrentValue<T>(data: Buffer): Promise<T> {
  const json = await decompressFromBuffer(data);
  return JSON.parse(json) as T;
}

async function deserializeLegacyValue<T>(
  entry: PackageCacheLegacyEntry,
): Promise<T> {
  const json = await decompressFromBase64(entry.value);
  return JSON.parse(json) as T;
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

  private async putCurrentEntry(
    cacheKey: string,
    serializedValue: string,
    expiry: string,
  ): Promise<void> {
    const compressedValue = await compressToBuffer(serializedValue);
    await cacache.put(this.cacheFileName, cacheKey, compressedValue, {
      metadata: {
        expiry,
        format: currentCacheFormat,
        version: currentCacheVersion,
      },
    });
  }

  private async getLegacy<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
    const legacyEntry = parseLegacyCacheEntry(cacheEntry.data);

    if (!legacyEntry) {
      await this.rm(namespace, key);
      return undefined;
    }

    const expiry = DateTime.fromISO(legacyEntry.expiry);
    if (!expiry.isValid || DateTime.local() >= expiry) {
      await this.rm(namespace, key);
      return undefined;
    }

    logger.trace({ namespace, key }, 'Returning cached value');
    return await deserializeLegacyValue<T>(legacyEntry);
  }

  private async migrateLegacyEntry(cacheKey: string): Promise<boolean> {
    const legacyEntry = await cacache.get(this.cacheFileName, cacheKey);
    let cachedValue: PackageCacheLegacyEntry | undefined;

    try {
      cachedValue = parseLegacyCacheEntry(legacyEntry.data);
    } catch {
      logger.debug('Error parsing cached value - deleting');
    }

    if (!cachedValue) {
      await this.rmEntry(cacheKey);
      return true;
    }

    const expiry = DateTime.fromISO(cachedValue.expiry);
    if (!expiry.isValid || DateTime.local() >= expiry) {
      await this.rmEntry(cacheKey);
      return true;
    }

    const serializedValue = await decompressFromBase64(cachedValue.value);
    await this.putCurrentEntry(cacheKey, serializedValue, cachedValue.expiry);
    return false;
  }

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    try {
      const cacheKey = this.getKey(namespace, key);
      const cacheInfo = await cacache.get.info(this.cacheFileName, cacheKey);

      if (!cacheInfo) {
        return undefined;
      }

      if (cacheInfo.metadata !== undefined) {
        const metadata = parseCacheMetadata(cacheInfo.metadata);
        if (!metadata) {
          await this.rm(namespace, key);
          return undefined;
        }

        const expiry = DateTime.fromISO(metadata.expiry);
        if (!expiry.isValid || DateTime.local() >= expiry) {
          await this.rm(namespace, key);
          return undefined;
        }

        const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
        logger.trace({ namespace, key }, 'Returning cached value');
        return await deserializeCurrentValue<T>(cacheEntry.data);
      }

      return await this.getLegacy<T>(namespace, key, cacheKey);
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
    const expiry = DateTime.local().plus({ minutes: hardTtlMinutes }).toISO();
    if (!expiry) {
      throw new Error('Invalid package cache expiry');
    }

    await this.putCurrentEntry(this.getKey(namespace, key), serialized, expiry);
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

        if (cacheEntry.metadata !== undefined) {
          const metadata = parseCacheMetadata(cacheEntry.metadata);
          if (!metadata) {
            await this.rmEntry(cacheEntry.key);
            deletedCount += 1;
            continue;
          }

          const expiry = DateTime.fromISO(metadata.expiry);
          if (expiry.isValid && DateTime.local() <= expiry) {
            continue;
          }

          await this.rmEntry(cacheEntry.key);
          deletedCount += 1;
          continue;
        }

        deletedCount += (await this.migrateLegacyEntry(cacheEntry.key)) ? 1 : 0;
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
    await this.rmEntry(this.getKey(namespace, key));
  }

  private async rmEntry(cacheKey: string): Promise<void> {
    await cacache.rm.entry(this.cacheFileName, cacheKey);
  }
}
