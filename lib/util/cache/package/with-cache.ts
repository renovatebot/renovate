import { isUndefined } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { acquireLock } from '../../mutex.ts';
import * as packageCache from './index.ts';
import { buildCacheKey } from './key.ts';
import { resolveTtlValues } from './ttl.ts';
import type { CachedRecord, PackageCacheNamespace } from './types.ts';

export interface CacheContext {
  /**
   * Whether the result may be shared through the package cache.
   * `cachePrivatePackages` allows storage when this is `false`.
   * @default true
   */
  public: boolean;

  /**
   * Whether the result should be stored in the cache.
   * `false` prevents storage even when `cachePrivatePackages` is enabled.
   * @default true
   */
  cacheable: boolean;
}

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
   * Whether the result may be shared through the package cache.
   * @default true
   */
  public?: boolean;

  /**
   * Enable extended hard TTL for graceful degradation.
   * When true and upstream errors occur, stale cached data is returned.
   * @default false
   */
  fallback?: boolean;
}

/**
 * Caches the result of a function.
 *
 * @param options - Cache options
 * @param fn - The function to cache
 * @returns The cached or fresh result
 */
export async function withCache<T>(
  options: CachedOptions,
  fn: (ctx: CacheContext) => T | PromiseLike<T>,
): Promise<Awaited<T>> {
  const { namespace, key, ttlMinutes = 30, fallback = false } = options;

  const ctx: CacheContext = {
    public: options.public ?? true,
    cacheable: true,
  };
  const cachePrivatePackages = GlobalConfig.get('cachePrivatePackages');

  function canUseCache(): boolean {
    return ctx.cacheable && (ctx.public || cachePrivatePackages);
  }

  if (!canUseCache()) {
    return await fn(ctx);
  }

  // istanbul ignore if -- TODO: add test #40625
  if (!namespace || !key) {
    return await fn(ctx);
  }

  const cacheKey = buildCacheKey('cache-decorator', key);

  // prevent concurrent processing and cache writes
  const releaseLock = await acquireLock(cacheKey, namespace);

  try {
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
    if (cachedRecord) {
      const now = DateTime.local();
      const cachedAt = DateTime.fromISO(cachedRecord.cachedAt);

      const softDeadline = cachedAt.plus({ minutes: softTtlMinutes });
      if (now < softDeadline) {
        return cachedRecord.value as Awaited<T>;
      }

      const hardDeadline = cachedAt.plus({ minutes: hardTtlMinutes });
      if (now < hardDeadline) {
        fallbackValue = cachedRecord.value;
      }
    }

    let newValue: Awaited<T>;
    try {
      newValue = await fn(ctx);
    } catch (err) {
      if (!isUndefined(fallbackValue)) {
        logger.debug(
          { err },
          'Package cache: callback error, returning stale data',
        );
        return fallbackValue as Awaited<T>;
      }
      throw err;
    }

    if (!isUndefined(newValue) && canUseCache()) {
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
  } finally {
    releaseLock();
  }
}
