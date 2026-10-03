import { isUndefined } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import * as packageCache from './index.ts';
import { resolveTtlValues } from './ttl.ts';
import type { CachedRecord, PackageCacheNamespace } from './types.ts';

export interface CachedOptions {
  /**
   * The cache namespace.
   */
  namespace: PackageCacheNamespace;

  /**
   * The cache key.
   */
  key: string;

  /**
   * The TTL (or expiry) of the key in minutes.
   * @default 30
   */
  ttlMinutes?: number;

  /**
   * Whether caching is enabled for this call.
   * When false, the function is called directly without caching.
   * @default true
   */
  cacheable?: boolean;

  /**
   * Whether a cache result is safe to use and store for this call.
   * @default value !== undefined
   */
  shouldCacheResult?: (value: unknown) => boolean;

  /**
   * Enable extended hard TTL for graceful degradation.
   * When true and upstream errors occur, stale cached data is returned.
   * @default false
   */
  fallback?: boolean;
}

const activeLookups = new Map<string, Promise<unknown>>();

function defaultShouldCacheResult(_value: unknown): boolean {
  return true;
}

/**
 * Caches the result of an async function.
 *
 * @param options - Cache options
 * @param fn - The async function to cache
 * @returns The cached or fresh result
 */
export async function withCache<T>(
  options: CachedOptions,
  fn: () => T | Promise<T>,
): Promise<T> {
  const {
    namespace,
    key,
    ttlMinutes = 30,
    cacheable = true,
    fallback = false,
  } = options;

  const cachePrivatePackages = GlobalConfig.get('cachePrivatePackages');
  const isCacheable = cachePrivatePackages || cacheable;
  if (!isCacheable) {
    return fn();
  }

  const shouldCacheResult =
    options.shouldCacheResult ?? defaultShouldCacheResult;

  // istanbul ignore if -- TODO: add test #40625
  if (!namespace || !key) {
    return fn();
  }

  const cacheKey = `cache-decorator:${key}`;

  // Let one caller fetch and update a cache key at a time. Every waiting
  // caller re-evaluates the cache with its own options after the active lookup
  // settles, including when the first result was not cached or failed.
  const activeKey = JSON.stringify([namespace, cacheKey]);
  for (;;) {
    const active = activeLookups.get(activeKey);
    if (!active) {
      break;
    }
    try {
      await active;
    } catch {
      // A different caller's failure does not decide this caller's result.
    }
  }

  const promise = readOrFetch();
  activeLookups.set(activeKey, promise);
  try {
    return await promise;
  } finally {
    activeLookups.delete(activeKey);
  }

  async function readOrFetch(): Promise<T> {
    const cachedRecord = await packageCache.get<CachedRecord>(
      namespace,
      cacheKey,
    );

    const { softTtlMinutes, hardTtlMinutes: resolvedHardTtl } =
      resolveTtlValues(namespace, ttlMinutes);

    // The separation between "soft" and "hard" TTL allows us to treat
    // data as obsolete according to the "soft" TTL while physically storing it
    // according to the "hard" TTL.
    //
    // This helps us return obsolete data in case of upstream server errors,
    // which is more useful than throwing exceptions ourselves.
    //
    // The `fallback` option controls whether this extended TTL behavior is used.
    // When false, the "soft" just equals the "hard" ttl.
    const hardTtlMinutes = fallback ? resolvedHardTtl : softTtlMinutes;

    let fallbackValue: unknown;
    if (cachedRecord && shouldCacheResult(cachedRecord.value)) {
      const now = DateTime.local();
      const cachedAt = DateTime.fromISO(cachedRecord.cachedAt);

      const softDeadline = cachedAt.plus({ minutes: softTtlMinutes });
      if (now < softDeadline) {
        return cachedRecord.value as T;
      }

      const hardDeadline = cachedAt.plus({ minutes: hardTtlMinutes });
      if (now < hardDeadline) {
        fallbackValue = cachedRecord.value;
      }
    }

    let newValue: T;
    try {
      newValue = await fn();
    } catch (err) {
      if (!isUndefined(fallbackValue)) {
        logger.debug(
          { err },
          'Package cache: callback error, returning stale data',
        );
        return fallbackValue as T;
      }
      throw err;
    }

    if (!isUndefined(newValue) && shouldCacheResult(newValue)) {
      const newRecord: CachedRecord = {
        cachedAt: DateTime.local().toISO(),
        value: newValue,
      };
      await packageCache.setWithRawTtl(
        namespace,
        cacheKey,
        newRecord,
        hardTtlMinutes,
      );
    }

    return newValue;
  }
}
