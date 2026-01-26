import { isString, isUndefined } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { Decorator } from '../../decorator';
import { decorate } from '../../decorator';
import { acquireLock } from '../../mutex';
import { resolveTtlValues } from './ttl';
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

    const finalNamespace = isString(namespace)
      ? namespace
      : namespace.apply(instance, args);

    const finalKey = isString(key) ? key : key.apply(instance, args);

    // istanbul ignore if
    if (!finalNamespace || !finalKey) {
      return callback();
    }

    const cacheKey = `cache-decorator:${finalKey}`;

    // prevent concurrent processing and cache writes
    const releaseLock = await acquireLock(cacheKey, finalNamespace);

    try {
      const cachedRecord = await packageCache.get<DecoratorCachedRecord>(
        finalNamespace,
        cacheKey,
      );

      // eslint-disable-next-line prefer-const
      let { softTtlMinutes, hardTtlMinutes } = resolveTtlValues(
        finalNamespace,
        ttlMinutes,
      );

      // The separation between "soft" and "hard" TTL allows us to treat
      // data as obsolete according to the "soft" TTL while physically storing it
      // according to the "hard" TTL.
      //
      // This helps us return obsolete data in case of upstream server errors,
      // which is more useful than throwing exceptions ourselves.
      //
      // However, since the default hard TTL is one week, it could create
      // unnecessary pressure on storage volume. Therefore,
      // we cache only `getReleases` and `getDigest` results for an extended period.
      //
      // For other method names being decorated, the "soft" just equals the "hard" ttl.
      if (methodName !== 'getReleases' && methodName !== 'getDigest') {
        hardTtlMinutes = softTtlMinutes;
      }

      let fallbackValue: unknown;
      if (cachedRecord) {
        const now = DateTime.local();
        const cachedAt = DateTime.fromISO(cachedRecord.cachedAt);

        const softDeadline = cachedAt.plus({ minutes: softTtlMinutes });
        if (now < softDeadline) {
          return cachedRecord.value;
        }

        const hardDeadline = cachedAt.plus({ minutes: hardTtlMinutes });
        if (now < hardDeadline) {
          fallbackValue = cachedRecord.value;
        }
      }

      let newValue: unknown;
      try {
        newValue = await callback();
      } catch (err) {
        if (!isUndefined(fallbackValue)) {
          logger.debug(
            { err },
            'Package cache decorator: callback error, returning old data',
          );
          return fallbackValue;
        }
        throw err;
      }

      if (!isUndefined(newValue)) {
        const newRecord: DecoratorCachedRecord = {
          cachedAt: DateTime.local().toISO(),
          value: newValue,
        };
        await packageCache.setWithRawTtl(
          finalNamespace,
          cacheKey,
          newRecord,
          hardTtlMinutes,
        );
      }

      return newValue;
    } finally {
      releaseLock();
    }
  });
}
