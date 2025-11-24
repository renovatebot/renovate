import { isString, isUndefined } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { Decorator } from '../../decorator';
import { decorate } from '../../decorator';
import { acquireLock } from '../../mutex';
import { resolveTtlValues } from './ttl';
import type { DecoratorCachedRecord, PackageCacheNamespace } from './types';
import { packageCache } from '.';

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

export function cache<T>({
  namespace,
  key,
  cacheable = () => true,
  ttlMinutes = 30,
}: CacheParameters): Decorator<T> {
  return decorate(async ({ args, instance, callback, methodName }) => {
    if (
      !GlobalConfig.get('cachePrivatePackages', false) &&
      !cacheable.apply(instance, args)
    ) {
      return callback();
    }

    const finalNamespace = isString(namespace)
      ? namespace
      : namespace.apply(instance, args);
    const finalKey = isString(key) ? key : key.apply(instance, args);

    if (!finalNamespace || !finalKey) {
      return callback();
    }

    const cacheKey = `cache-decorator:${finalKey}`;
    const releaseLock = await acquireLock(cacheKey, finalNamespace);

    try {
      const cachedRecord = await packageCache.get<DecoratorCachedRecord>(
        finalNamespace,
        cacheKey,
      );

      let {
        // eslint-disable-next-line prefer-const
        softTtlMinutes,
        hardTtlMinutes,
      } = resolveTtlValues(finalNamespace, ttlMinutes);

      // Hard TTL (stale fallback) is enabled only for specific methods
      if (methodName !== 'getReleases' && methodName !== 'getDigest') {
        hardTtlMinutes = softTtlMinutes;
      }

      let fallbackValue: unknown;
      if (cachedRecord) {
        const now = DateTime.local();
        const cachedAt = DateTime.fromISO(cachedRecord.cachedAt);

        if (now < cachedAt.plus({ minutes: softTtlMinutes })) {
          return cachedRecord.value;
        }

        if (now < cachedAt.plus({ minutes: hardTtlMinutes })) {
          fallbackValue = cachedRecord.value;
        }
      }

      let newValue: unknown;
      try {
        newValue = await callback();
      } catch (err) {
        if (fallbackValue !== undefined) {
          logger.debug(
            { err },
            'Package cache decorator: callback error, returning old data',
          );
          return fallbackValue;
        }
        throw err;
      }

      if (!isUndefined(newValue)) {
        await packageCache.setWithRawTtl(
          finalNamespace,
          cacheKey,
          { cachedAt: DateTime.local().toISO(), value: newValue },
          hardTtlMinutes,
        );
      }

      return newValue;
    } finally {
      releaseLock();
    }
  });
}
