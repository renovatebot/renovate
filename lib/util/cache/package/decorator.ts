import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { Decorator } from '../../decorator';
import { decorate } from '../../decorator';
import { acquireLock } from '../../mutex';
import type { DecoratorCachedRecord, PackageCacheNamespace } from './types';
import * as packageCache from '.';

type HashFunction<T extends any[] = any[]> = (...args: T) => string;
type NamespaceFunction<T extends any[] = any[]> = (
  ...args: T
) => PackageCacheNamespace;
type BooleanFunction<T extends any[] = any[]> = (...args: T) => boolean;

/**
 * The cache decorator parameters.
 */
interface CacheParameters {
  /**
   * The cache namespace
   * Either a string or a hash function that generates a string
   */
  namespace: PackageCacheNamespace | NamespaceFunction;

  /**
   * The cache key
   * Either a string or a hash function that generates a string
   */
  key: string | HashFunction;

  /**
   * A function that returns true if a result is cacheable
   * Used to prevent caching of private, sensitive, results
   */
  cacheable?: BooleanFunction;

  /**
   * The TTL (or expiry) of the key in minutes
   */
  ttlMinutes?: number;
}

/**
 * caches the result of a decorated method.
 */
export function cache<T>({
  namespace,
  key,
  cacheable = () => true,
  ttlMinutes = 30,
}: CacheParameters): Decorator<T> {
  return decorate(async ({ args, instance, callback, methodName }) => {
    const cachePrivatePackages = GlobalConfig.get(
      'cachePrivatePackages',
      false,
    );
    const isCacheable = cachePrivatePackages || cacheable.apply(instance, args);
    if (!isCacheable) {
      return callback();
    }

    let finalNamespace: PackageCacheNamespace | undefined;
    if (is.string(namespace)) {
      finalNamespace = namespace;
    } else if (is.function_(namespace)) {
      finalNamespace = namespace.apply(instance, args);
    }

    let finalKey: string | undefined;
    if (is.string(key)) {
      finalKey = key;
    } else if (is.function_(key)) {
      finalKey = key.apply(instance, args);
    }

    // istanbul ignore if
    if (!finalNamespace || !finalKey) {
      return callback();
    }

    finalKey = `cache-decorator:${finalKey}`;

    // prevent concurrent processing and cache writes
    const releaseLock = await acquireLock(finalKey, finalNamespace);

    try {
      const oldRecord = await packageCache.get<DecoratorCachedRecord>(
        finalNamespace,
        finalKey,
      );

      const ttlOverride = getTtlOverride(finalNamespace);
      const softTtl = ttlOverride ?? ttlMinutes;

      const cacheHardTtlMinutes = GlobalConfig.get(
        'cacheHardTtlMinutes',
        7 * 24 * 60,
      );
      let hardTtl = softTtl;
      if (methodName === 'getReleases' || methodName === 'getDigest') {
        hardTtl = Math.max(softTtl, cacheHardTtlMinutes);
      }

      let oldData: unknown;
      if (oldRecord) {
        const now = DateTime.local();
        const cachedAt = DateTime.fromISO(oldRecord.cachedAt);

        const softDeadline = cachedAt.plus({ minutes: softTtl });
        if (now < softDeadline) {
          return oldRecord.value;
        }

        const hardDeadline = cachedAt.plus({ minutes: hardTtl });
        if (now < hardDeadline) {
          oldData = oldRecord.value;
        }
      }

      let newData: unknown;
      if (oldData) {
        try {
          newData = (await callback()) as T | undefined;
        } catch (err) {
          logger.debug(
            { err },
            'Package cache decorator: callback error, returning old data',
          );
          return oldData;
        }
      } else {
        newData = (await callback()) as T | undefined;
      }

      if (!is.undefined(newData)) {
        const newRecord: DecoratorCachedRecord = {
          cachedAt: DateTime.local().toISO(),
          value: newData,
        };
        await packageCache.set(finalNamespace, finalKey, newRecord, hardTtl);
      }

      return newData;
    } finally {
      releaseLock();
    }
  });
}

export function getTtlOverride(namespace: string): number | undefined {
  const ttl: unknown = GlobalConfig.get('cacheTtlOverride', {})[namespace];
  if (is.number(ttl)) {
    return ttl;
  }
  return undefined;
}
