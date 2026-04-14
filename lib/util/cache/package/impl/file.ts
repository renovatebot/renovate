import { isNonEmptyString, isPlainObject, isString } from '@sindresorhus/is';
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

interface LegacyPayload {
  expiry: string;
  value: string;
}

interface CacheIndexMetadata {
  expiry: string;
  version: number;
}

interface CacheIndexEntry {
  key: string;
  integrity: string;
  metadata?: unknown;
}

type CacheIndexSweepResult =
  | { status: 'deleted'; contentDigest: string }
  | { status: 'kept'; contentDigest: string }
  | {
      status: 'migrated';
      liveContentDigest: string;
      replacedContentDigest: string;
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

function parseCacheIndexMetadata(
  value: unknown,
): CacheIndexMetadata | undefined {
  if (!isPlainObject(value) || !isString(value.expiry)) {
    return undefined;
  }

  if (value.version !== CACHE_VERSION) {
    return undefined;
  }

  return { expiry: value.expiry, version: value.version };
}

function parseLegacyPayload(data: Buffer): LegacyPayload | undefined {
  const parsed = parseJsonSafe(data.toString());
  if (parsed === undefined) {
    logger.debug('Error parsing cached value - deleting');
    return undefined;
  }

  if (!isPlainObject(parsed)) {
    return undefined;
  }

  const { expiry, value } = parsed;

  if (!isString(expiry) || !isString(value)) {
    return undefined;
  }

  return { expiry, value };
}

function isCacheIndexEntry(value: unknown): value is CacheIndexEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return isNonEmptyString(value.key) && isNonEmptyString(value.integrity);
}

async function decodeCurrentStoredValue<T>(data: Buffer): Promise<T> {
  const json = await decompressFromBuffer(data);
  const parsed = parseJsonSafe<T>(json);

  if (parsed === undefined) {
    throw new Error('Failed to deserialize cached value');
  }

  return parsed;
}

async function decodeLegacyStoredValue<T>(payload: LegacyPayload): Promise<T> {
  const json = await decompressFromBase64(payload.value);
  const parsed = parseJsonSafe<T>(json);

  if (parsed === undefined) {
    throw new Error('Failed to deserialize cached value');
  }

  return parsed;
}

export class PackageCacheFile extends PackageCacheBase {
  static create(cacheDir: string): PackageCacheFile {
    const cachePath = upath.join(cacheDir, '/renovate/renovate-cache-v1');
    logger.debug(`Initializing Renovate internal cache into ${cachePath}`);
    return new PackageCacheFile(cachePath);
  }

  private readonly cachePath: string;

  private constructor(cachePath: string) {
    super();
    this.cachePath = cachePath;
  }

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const cacheIndexKey = this.getCacheIndexKey(namespace, key);
    const cacheIndexEntry = await this.getCacheIndexEntry(
      cacheIndexKey,
      namespace,
      key,
    );

    if (!cacheIndexEntry) {
      return undefined;
    }

    if (cacheIndexEntry.metadata === undefined) {
      return await this.readLegacyCachedValue<T>(namespace, key, cacheIndexKey);
    }

    const metadata = parseCacheIndexMetadata(cacheIndexEntry.metadata);

    if (metadata !== undefined && !isExpired(metadata.expiry)) {
      return await this.readCurrentCachedValue<T>(
        namespace,
        key,
        cacheIndexKey,
      );
    }

    await this.removeLogicalCacheEntry(namespace, key);
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

    const cacheIndexKey = this.getCacheIndexKey(namespace, key);
    await this.writeSerializedCacheIndexEntry(
      cacheIndexKey,
      serialized,
      expiry,
    );
  }

  override async destroy(): Promise<void> {
    logger.debug('Checking file package cache for expired items');

    let totalCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    const startTime = Date.now();
    const candidateContentDigests = new Set<string>();
    const liveContentDigests = new Set<string>();

    for await (const item of cacache.ls.stream(this.cachePath)) {
      totalCount += 1;
      if (!isCacheIndexEntry(item)) {
        logger.trace('Invalid cache index entry stream payload');
        errorCount += 1;
        continue;
      }

      const sweepResult = await this.trySweepCacheIndexEntry(item);
      if (sweepResult === undefined) {
        errorCount += 1;
        continue;
      }

      if (sweepResult.status === 'deleted') {
        deletedCount += 1;
        candidateContentDigests.add(sweepResult.contentDigest);
        continue;
      }

      if (sweepResult.status === 'kept') {
        liveContentDigests.add(sweepResult.contentDigest);
        continue;
      }

      candidateContentDigests.add(sweepResult.replacedContentDigest);
      liveContentDigests.add(sweepResult.liveContentDigest);
    }

    errorCount += await this.removeUnreferencedContent(
      candidateContentDigests,
      liveContentDigests,
    );

    if (errorCount > 0) {
      logger.debug(`Error count cleaning up cache: ${errorCount}`);
    }
    const durationMs = Date.now() - startTime;
    logger.debug(
      `Deleted ${deletedCount} of ${totalCount} file cached entries in ${durationMs}ms`,
    );
  }

  private getCacheIndexKey(
    namespace: PackageCacheNamespace,
    key: string,
  ): string {
    return `${namespace}-${key}`;
  }

  private async getCacheIndexEntry(
    cacheIndexKey: string,
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<CacheIndexEntry | null> {
    try {
      return await cacache.get.info(this.cachePath, cacheIndexKey);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return null;
    }
  }

  private async writeCacheIndexEntry(
    cacheIndexKey: string,
    compressedValue: Buffer,
    expiry: string,
  ): Promise<string> {
    const metadata = { version: CACHE_VERSION, expiry };
    return await cacache.put(this.cachePath, cacheIndexKey, compressedValue, {
      metadata,
    });
  }

  private async writeSerializedCacheIndexEntry(
    cacheIndexKey: string,
    serializedValue: string,
    expiry: string,
  ): Promise<void> {
    const compressedValue = await compressToBuffer(serializedValue);
    await this.writeCacheIndexEntry(cacheIndexKey, compressedValue, expiry);
  }

  private async readLegacyCachedValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheIndexKey: string,
  ): Promise<T | undefined> {
    try {
      const storedEntry = await cacache.get(this.cachePath, cacheIndexKey);
      const legacyPayload = parseLegacyPayload(storedEntry.data);

      if (legacyPayload !== undefined && !isExpired(legacyPayload.expiry)) {
        logger.trace({ namespace, key }, 'Returning cached value');
        return await decodeLegacyStoredValue<T>(legacyPayload);
      }

      await this.removeLogicalCacheEntry(namespace, key);
      return undefined;
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async readCurrentCachedValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheIndexKey: string,
  ): Promise<T | undefined> {
    try {
      const storedEntry = await cacache.get(this.cachePath, cacheIndexKey);
      logger.trace({ namespace, key }, 'Returning cached value');
      return await decodeCurrentStoredValue<T>(storedEntry.data);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async migrateLegacyCacheIndexEntry(
    cacheIndexKey: string,
    contentDigest: string,
  ): Promise<CacheIndexSweepResult> {
    const legacyEntry = await cacache.get(this.cachePath, cacheIndexKey);
    const legacyPayload = parseLegacyPayload(legacyEntry.data);

    if (!legacyPayload) {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    if (isExpired(legacyPayload.expiry)) {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    const compressedValue = Buffer.from(legacyPayload.value, 'base64');

    let serializedValue: string;
    try {
      serializedValue = await decompressFromBuffer(compressedValue);
    } catch {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    if (parseJsonSafe(serializedValue) === undefined) {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    const liveContentDigest = await this.writeCacheIndexEntry(
      cacheIndexKey,
      compressedValue,
      legacyPayload.expiry,
    );

    return {
      status: 'migrated',
      liveContentDigest,
      replacedContentDigest: contentDigest,
    };
  }

  private async sweepCacheIndexEntry(
    cacheIndexEntry: CacheIndexEntry,
  ): Promise<CacheIndexSweepResult> {
    const {
      key: cacheIndexKey,
      metadata: rawMetadata,
      integrity: contentDigest,
    } = cacheIndexEntry;

    if (rawMetadata === undefined) {
      return this.migrateLegacyCacheIndexEntry(cacheIndexKey, contentDigest);
    }

    const parsedMetadata = parseCacheIndexMetadata(rawMetadata);
    if (!parsedMetadata) {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    if (isExpired(parsedMetadata.expiry)) {
      await this.removeCacheIndexEntry(cacheIndexKey);
      return { status: 'deleted', contentDigest };
    }

    return { status: 'kept', contentDigest };
  }

  private async trySweepCacheIndexEntry(
    cacheIndexEntry: CacheIndexEntry,
  ): Promise<CacheIndexSweepResult | undefined> {
    try {
      return await this.sweepCacheIndexEntry(cacheIndexEntry);
    } catch (err) {
      logger.trace({ err }, 'Error classifying cache entry');
      return undefined;
    }
  }

  private async removeUnreferencedContent(
    candidateContentDigests: ReadonlySet<string>,
    liveContentDigests: ReadonlySet<string>,
  ): Promise<number> {
    let errorCount = 0;

    for (const contentDigest of candidateContentDigests) {
      if (liveContentDigests.has(contentDigest)) {
        continue;
      }

      try {
        await cacache.rm.content(this.cachePath, contentDigest);
      } catch (err) {
        logger.trace(
          { err, digest: contentDigest },
          'Error cleaning up cache content',
        );
        errorCount += 1;
      }
    }

    return errorCount;
  }

  private async removeLogicalCacheEntry(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace({ namespace, key }, 'Removing cache entry');
    await this.removeCacheIndexEntry(this.getCacheIndexKey(namespace, key));
  }

  private async removeCacheIndexEntry(cacheIndexKey: string): Promise<void> {
    await cacache.rm.entry(this.cachePath, cacheIndexKey);
  }
}
