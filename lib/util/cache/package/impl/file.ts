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

interface CacheMetadata {
  expiry: string;
  version: number;
}

interface CacheEntry {
  key: string;
  integrity: string;
  metadata?: unknown;
}

type CacheSweepResult =
  | { status: 'deleted'; digest: string }
  | { status: 'kept'; digest: string }
  | { status: 'migrated'; liveDigest: string; replacedDigest: string };

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

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return isNonEmptyString(value.key) && isNonEmptyString(value.integrity);
}

async function decodeStoredValue<T>(data: Buffer): Promise<T> {
  const json = await decompressFromBuffer(data);
  const parsed = parseJsonSafe<T>(json);

  if (parsed === undefined) {
    throw new Error('Failed to deserialize cached value');
  }

  return parsed;
}

async function decodeLegacyPayloadValue<T>(payload: LegacyPayload): Promise<T> {
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
    const cacheKey = this.getCacheKey(namespace, key);
    const cacheIndexEntry = await this.getCacheIndexEntry(
      cacheKey,
      namespace,
      key,
    );

    if (!cacheIndexEntry) {
      return undefined;
    }

    if (cacheIndexEntry.metadata !== undefined) {
      const metadata = parseCacheMetadata(cacheIndexEntry.metadata);

      if (metadata === undefined || isExpired(metadata.expiry)) {
        await this.removeCacheEntry(namespace, key);
        return undefined;
      }

      return await this.getCurrentValue<T>(namespace, key, cacheKey);
    }

    return await this.getLegacyValue<T>(namespace, key, cacheKey);
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

    const cacheKey = this.getCacheKey(namespace, key);
    await this.writeSerializedCacheEntry(cacheKey, serialized, expiry);
  }

  override async destroy(): Promise<void> {
    logger.debug('Checking file package cache for expired items');

    let totalCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    const startTime = Date.now();
    const candidateDigests = new Set<string>();
    const liveDigests = new Set<string>();

    for await (const item of cacache.ls.stream(this.cachePath)) {
      totalCount += 1;
      if (!isCacheEntry(item)) {
        logger.trace('Invalid cache index entry stream payload');
        errorCount += 1;
        continue;
      }

      const cacheSweepResult = await this.safeClassifyCacheIndexEntry(item);
      if (cacheSweepResult === undefined) {
        errorCount += 1;
        continue;
      }

      if (cacheSweepResult.status === 'deleted') {
        deletedCount += 1;
        candidateDigests.add(cacheSweepResult.digest);
        continue;
      }

      if (cacheSweepResult.status === 'kept') {
        liveDigests.add(cacheSweepResult.digest);
        continue;
      }

      candidateDigests.add(cacheSweepResult.replacedDigest);
      liveDigests.add(cacheSweepResult.liveDigest);
    }

    errorCount += await this.cleanupUnreferencedContent(
      candidateDigests,
      liveDigests,
    );

    if (errorCount > 0) {
      logger.debug(`Error count cleaning up cache: ${errorCount}`);
    }
    const durationMs = Date.now() - startTime;
    logger.debug(
      `Deleted ${deletedCount} of ${totalCount} file cached entries in ${durationMs}ms`,
    );
  }

  private getCacheKey(namespace: PackageCacheNamespace, key: string): string {
    return `${namespace}-${key}`;
  }

  private async getCacheIndexEntry(
    cacheKey: string,
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<CacheEntry | null> {
    try {
      return await cacache.get.info(this.cachePath, cacheKey);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return null;
    }
  }

  private async writeCacheEntry(
    cacheKey: string,
    compressedValue: Buffer,
    expiry: string,
  ): Promise<string> {
    const metadata = { version: CACHE_VERSION, expiry };
    return await cacache.put(this.cachePath, cacheKey, compressedValue, {
      metadata,
    });
  }

  private async writeSerializedCacheEntry(
    cacheKey: string,
    serializedValue: string,
    expiry: string,
  ): Promise<void> {
    const compressedValue = await compressToBuffer(serializedValue);
    await this.writeCacheEntry(cacheKey, compressedValue, expiry);
  }

  private async getLegacyValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    try {
      const cacheEntry = await cacache.get(this.cachePath, cacheKey);
      const legacyPayload = parseLegacyPayload(cacheEntry.data);

      if (!legacyPayload) {
        await this.removeCacheEntry(namespace, key);
        return undefined;
      }

      if (isExpired(legacyPayload.expiry)) {
        await this.removeCacheEntry(namespace, key);
        return undefined;
      }

      logger.trace({ namespace, key }, 'Returning cached value');
      return await decodeLegacyPayloadValue<T>(legacyPayload);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async getCurrentValue<T>(
    namespace: PackageCacheNamespace,
    key: string,
    cacheKey: string,
  ): Promise<T | undefined> {
    try {
      const cacheEntry = await cacache.get(this.cachePath, cacheKey);
      logger.trace({ namespace, key }, 'Returning cached value');
      return await decodeStoredValue<T>(cacheEntry.data);
    } catch (err) {
      logger.trace({ err, namespace, key }, 'Cache miss');
      return undefined;
    }
  }

  private async migrateLegacyCacheEntry(
    cacheKey: string,
    digest: string,
  ): Promise<CacheSweepResult> {
    const legacyEntry = await cacache.get(this.cachePath, cacheKey);
    const legacyPayload = parseLegacyPayload(legacyEntry.data);

    if (!legacyPayload) {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (isExpired(legacyPayload.expiry)) {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    const compressedValue = Buffer.from(legacyPayload.value, 'base64');

    let serializedValue: string;
    try {
      serializedValue = await decompressFromBuffer(compressedValue);
    } catch {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (parseJsonSafe(serializedValue) === undefined) {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    const migratedDigest = await this.writeCacheEntry(
      cacheKey,
      compressedValue,
      legacyPayload.expiry,
    );

    return {
      liveDigest: migratedDigest,
      replacedDigest: digest,
      status: 'migrated',
    };
  }

  private async classifyCacheIndexEntry(
    cacheEntry: CacheEntry,
  ): Promise<CacheSweepResult> {
    const {
      key: cacheKey,
      metadata: rawMetadata,
      integrity: digest,
    } = cacheEntry;

    if (rawMetadata === undefined) {
      return this.migrateLegacyCacheEntry(cacheKey, digest);
    }

    const parsedMetadata = parseCacheMetadata(rawMetadata);
    if (!parsedMetadata) {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    if (isExpired(parsedMetadata.expiry)) {
      await this.removeCacheIndexEntry(cacheKey);
      return { digest, status: 'deleted' };
    }

    return { digest, status: 'kept' };
  }

  private async safeClassifyCacheIndexEntry(
    cacheEntry: CacheEntry,
  ): Promise<CacheSweepResult | undefined> {
    try {
      return await this.classifyCacheIndexEntry(cacheEntry);
    } catch (err) {
      logger.trace({ err }, 'Error classifying cache entry');
      return undefined;
    }
  }

  private async cleanupUnreferencedContent(
    candidateDigests: ReadonlySet<string>,
    liveDigests: ReadonlySet<string>,
  ): Promise<number> {
    let errorCount = 0;

    for (const digest of candidateDigests) {
      if (liveDigests.has(digest)) {
        continue;
      }

      try {
        await cacache.rm.content(this.cachePath, digest);
      } catch (err) {
        logger.trace({ err, digest }, 'Error cleaning up cache content');
        errorCount += 1;
      }
    }

    return errorCount;
  }

  private async removeCacheEntry(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace({ namespace, key }, 'Removing cache entry');
    await this.removeCacheIndexEntry(this.getCacheKey(namespace, key));
  }

  private async removeCacheIndexEntry(cacheKey: string): Promise<void> {
    await cacache.rm.entry(this.cachePath, cacheKey);
  }
}
