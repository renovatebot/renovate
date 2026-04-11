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

const CACHE_VERSION = 2;

interface PackageCacheLegacyEntry {
  compress: true;
  expiry: string;
  value: string;
}

interface CacheMetadata {
  expiry: string;
  version: number;
}

type LegacyMigrationStatus = 'deleted' | 'migrated';
type CacheCleanupStatus = 'deleted' | 'kept';

function parseJsonSafe<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function isExpiredAt(expiry: string, now: DateTime): boolean {
  const expiryDateTime = DateTime.fromISO(expiry);
  if (!expiryDateTime.isValid) {
    return true;
  }

  return now >= expiryDateTime;
}

function parseCacheMetadata(value: unknown): CacheMetadata | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const { expiry, version } = value;

  if (typeof expiry !== 'string' || version !== CACHE_VERSION) {
    return undefined;
  }

  return { expiry, version };
}

function parseLegacyCachePayload(
  data: Buffer,
): PackageCacheLegacyEntry | undefined {
  const parsed = parseJsonSafe<unknown>(data.toString());
  if (parsed === undefined) {
    logger.debug('Error parsing cached value - deleting');
    return undefined;
  }

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

  return { compress, expiry, value };
}

async function decodeValue<T>(data: Buffer): Promise<T> {
  const json = await decompressFromBuffer(data);
  const parsed = parseJsonSafe<T>(json);

  if (parsed === undefined) {
    throw new Error('Failed to deserialize cached value');
  }

  return parsed;
}

async function decodeLegacyValue<T>(
  entry: PackageCacheLegacyEntry,
): Promise<T> {
  const json = await decompressFromBase64(entry.value);
  const parsed = parseJsonSafe<T>(json);

  if (parsed === undefined) {
    throw new Error('Failed to deserialize cached value');
  }

  return parsed;
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

  private async putCacheEntry(
    cacheKey: string,
    serializedValue: string,
    expiry: string,
  ): Promise<void> {
    const compressedValue = await compressToBuffer(serializedValue);
    const metadata = { version: CACHE_VERSION, expiry };
    await cacache.put(this.cacheFileName, cacheKey, compressedValue, {
      metadata,
    });
  }

  private async getLegacy<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
    const legacyEntry = parseLegacyCachePayload(cacheEntry.data);

    if (!legacyEntry) {
      await this.rm(namespace, key);
      return undefined;
    }

    if (isExpiredAt(legacyEntry.expiry, DateTime.local())) {
      await this.rm(namespace, key);
      return undefined;
    }

    logger.trace({ namespace, key }, 'Returning cached value');
    return await decodeLegacyValue<T>(legacyEntry);
  }

  private async getValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T> {
    const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
    logger.trace({ namespace, key }, 'Returning cached value');
    return await decodeValue<T>(cacheEntry.data);
  }

  private async migrateLegacyCacheEntry(
    cacheKey: string,
  ): Promise<LegacyMigrationStatus> {
    const legacyEntry = await cacache.get(this.cacheFileName, cacheKey);
    const cachedValue = parseLegacyCachePayload(legacyEntry.data);

    if (!cachedValue) {
      await this.rmEntry(cacheKey);
      return 'deleted';
    }

    if (isExpiredAt(cachedValue.expiry, DateTime.local())) {
      await this.rmEntry(cacheKey);
      return 'deleted';
    }

    const serializedValue = await decompressFromBase64(cachedValue.value);
    await this.putCacheEntry(cacheKey, serializedValue, cachedValue.expiry);
    return 'migrated';
  }

  private async cleanupLegacyCacheEntry(
    cacheKey: string,
  ): Promise<CacheCleanupStatus> {
    const migrationResult = await this.migrateLegacyCacheEntry(cacheKey);
    if (migrationResult === 'deleted') {
      return 'deleted';
    }

    return 'kept';
  }

  private async cleanupEntryWithMetadata(
    cacheKey: string,
    rawMetadata: unknown,
    now: DateTime,
  ): Promise<CacheCleanupStatus> {
    const metadata = parseCacheMetadata(rawMetadata);
    if (!metadata) {
      await this.rmEntry(cacheKey);
      return 'deleted';
    }

    if (isExpiredAt(metadata.expiry, now)) {
      await this.rmEntry(cacheKey);
      return 'deleted';
    }

    return 'kept';
  }

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    try {
      const cacheKey = this.getKey(namespace, key);
      const cacheInfo = await cacache.get.info(this.cacheFileName, cacheKey);
      const now = DateTime.local();

      if (!cacheInfo) {
        return undefined;
      }

      if (cacheInfo.metadata !== undefined) {
        const metadata = parseCacheMetadata(cacheInfo.metadata);
        if (metadata === undefined || isExpiredAt(metadata.expiry, now)) {
          await this.rm(namespace, key);
          return undefined;
        }

        return await this.getValue<T>(namespace, key, cacheKey);
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

    const cacheKey = this.getKey(namespace, key);
    await this.putCacheEntry(cacheKey, serialized, expiry);
  }

  override async destroy(): Promise<void> {
    logger.debug('Checking file package cache for expired items');
    let totalCount = 0;
    let deletedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    const now = DateTime.local();
    for await (const item of cacache.ls.stream(this.cacheFileName)) {
      try {
        totalCount += 1;
        const cacheEntry = item as unknown as cacache.CacheObject;

        const cleanupResult =
          cacheEntry.metadata === undefined
            ? await this.cleanupLegacyCacheEntry(cacheEntry.key)
            : await this.cleanupEntryWithMetadata(
                cacheEntry.key,
                cacheEntry.metadata,
                now,
              );

        if (cleanupResult === 'deleted') {
          deletedCount += 1;
        }
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
