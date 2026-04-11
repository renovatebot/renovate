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

type CacheCleanupResult =
  | { digest: string; status: 'deleted' }
  | { digest: string; status: 'kept' }
  | {
      liveDigest: string;
      replacedDigest: string;
      status: 'migrated';
    };

function parseJsonSafe<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function isExpired(expiry: string): boolean {
  const expiryDateTime = DateTime.fromISO(expiry);
  if (!expiryDateTime.isValid) {
    return true;
  }

  return DateTime.local() >= expiryDateTime;
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
  const parsed = parseJsonSafe(data.toString());
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

  private async getCacheInfo(
    cacheKey: string,
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<cacache.CacheObject | null> {
    try {
      return await cacache.get.info(this.cacheFileName, cacheKey);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return null;
    }
  }

  private async putCacheEntry(
    cacheKey: string,
    compressedValue: Buffer,
    expiry: string,
  ): Promise<string> {
    const metadata = { version: CACHE_VERSION, expiry };
    return await cacache.put(this.cacheFileName, cacheKey, compressedValue, {
      metadata,
    });
  }

  private async putSerializedCacheEntry(
    cacheKey: string,
    serializedValue: string,
    expiry: string,
  ): Promise<void> {
    const compressedValue = await compressToBuffer(serializedValue);
    await this.putCacheEntry(cacheKey, compressedValue, expiry);
  }

  private async getLegacy<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    try {
      const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
      const legacyEntry = parseLegacyCachePayload(cacheEntry.data);

      if (!legacyEntry) {
        await this.rm(namespace, key);
        return undefined;
      }

      if (isExpired(legacyEntry.expiry)) {
        await this.rm(namespace, key);
        return undefined;
      }

      logger.trace({ namespace, key }, 'Returning cached value');
      return await decodeLegacyValue<T>(legacyEntry);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async getValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    try {
      const cacheEntry = await cacache.get(this.cacheFileName, cacheKey);
      logger.trace({ namespace, key }, 'Returning cached value');
      return await decodeValue<T>(cacheEntry.data);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async migrateLegacyCacheEntry(
    cacheKey: string,
    digest: string,
  ): Promise<CacheCleanupResult> {
    const legacyEntry = await cacache.get(this.cacheFileName, cacheKey);
    const cachedValue = parseLegacyCachePayload(legacyEntry.data);

    if (!cachedValue) {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (isExpired(cachedValue.expiry)) {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    const compressedValue = Buffer.from(cachedValue.value, 'base64');

    let serializedValue: string;
    try {
      serializedValue = await decompressFromBuffer(compressedValue);
    } catch {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (parseJsonSafe(serializedValue) === undefined) {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    const migratedDigest = await this.putCacheEntry(
      cacheKey,
      compressedValue,
      cachedValue.expiry,
    );

    return {
      liveDigest: migratedDigest,
      replacedDigest: digest,
      status: 'migrated',
    };
  }

  private async cleanupEntry(
    cacheKey: string,
    rawMetadata: unknown,
    digest: string,
  ): Promise<CacheCleanupResult> {
    const metadata = parseCacheMetadata(rawMetadata);
    if (!metadata) {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (isExpired(metadata.expiry)) {
      await this.rmEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    return { digest, status: 'kept' };
  }

  private async getCleanupResult(
    cacheEntry: cacache.CacheObject,
  ): Promise<CacheCleanupResult> {
    const { integrity: digest } = cacheEntry;

    if (cacheEntry.metadata === undefined) {
      return this.migrateLegacyCacheEntry(cacheEntry.key, digest);
    }

    return this.cleanupEntry(cacheEntry.key, cacheEntry.metadata, digest);
  }

  private async cleanupContent(
    candidateDigests: ReadonlySet<string>,
    liveDigests: ReadonlySet<string>,
  ): Promise<number> {
    let errorCount = 0;

    for (const digest of candidateDigests) {
      if (liveDigests.has(digest)) {
        continue;
      }

      try {
        await cacache.rm.content(this.cacheFileName, digest);
      } catch (err) {
        logger.trace({ err, digest }, 'Error cleaning up cache content');
        errorCount += 1;
      }
    }

    return errorCount;
  }

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const cacheKey = this.getKey(namespace, key);
    const cacheInfo = await this.getCacheInfo(cacheKey, namespace, key);

    if (!cacheInfo) {
      return undefined;
    }

    if (cacheInfo.metadata !== undefined) {
      const metadata = parseCacheMetadata(cacheInfo.metadata);
      if (metadata === undefined || isExpired(metadata.expiry)) {
        await this.rm(namespace, key);
        return undefined;
      }

      return await this.getValue<T>(namespace, key, cacheKey);
    }

    return await this.getLegacy<T>(namespace, key, cacheKey);
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

    const cacheKey = this.getKey(namespace, key);
    await this.putSerializedCacheEntry(cacheKey, serialized, expiry);
  }

  override async destroy(): Promise<void> {
    logger.debug('Checking file package cache for expired items');

    let totalCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    const startTime = Date.now();
    const candidateDigests = new Set<string>();
    const liveDigests = new Set<string>();

    for await (const item of cacache.ls.stream(this.cacheFileName)) {
      try {
        totalCount += 1;
        const cacheEntry = item as unknown as cacache.CacheObject;

        const cleanupResult = await this.getCleanupResult(cacheEntry);

        switch (cleanupResult.status) {
          case 'deleted':
            deletedCount += 1;
            candidateDigests.add(cleanupResult.digest);
            break;
          case 'kept':
            liveDigests.add(cleanupResult.digest);
            break;
          case 'migrated':
            candidateDigests.add(cleanupResult.replacedDigest);
            liveDigests.add(cleanupResult.liveDigest);
            break;
        }
      } catch (err) {
        logger.trace({ err }, 'Error cleaning up cache entry');
        errorCount += 1;
      }
    }

    errorCount += await this.cleanupContent(candidateDigests, liveDigests);

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
