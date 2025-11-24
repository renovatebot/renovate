import { isString, isUndefined } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { Decorator } from '../../decorator';
import { decorate } from '../../decorator';
import { getMutex } from '../../mutex';
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
   * Used to prevent caching of private, sensitive, results.
   *
   * NOTE:
   *   This means persistence between runs.
   *   During a single run, the data still could be cached.
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
    const finalNamespace = isString(namespace)
      ? namespace
      : namespace.apply(instance, args);
    const finalKey = isString(key) ? key : key.apply(instance, args);

    if (!finalNamespace || !finalKey) {
      return callback();
    }

    const cacheKey = `cache-decorator:${finalKey}`;
    const combinedKey = `${finalNamespace}:${cacheKey}`;

    if (packageCache.memory.has(combinedKey)) {
      const data = packageCache.memory.get(
        combinedKey,
      ) as DecoratorCachedRecord;
      return data.value;
    }

    return await getMutex(combinedKey, 'package-cache-decorator').runExclusive(
      async () => {
        if (packageCache.memory.has(combinedKey)) {
          const data = packageCache.memory.get(
            combinedKey,
          ) as DecoratorCachedRecord;
          return data.value;
        }

        if (
          !GlobalConfig.get('cachePrivatePackages', false) &&
          !cacheable.apply(instance, args)
        ) {
          const value = await callback();
          packageCache.memory.set(combinedKey, {
            cachedAt: DateTime.local().toISO(),
            value,
          });
          return value;
        }

        const cachedRecord = await packageCache.get<DecoratorCachedRecord>(
          finalNamespace,
          cacheKey,
        );

        let {
          // eslint-disable-next-line prefer-const
          softTtlMinutes,
          hardTtlMinutes,
        } = resolveTtlValues(finalNamespace, ttlMinutes);

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
        // We only extend the cache for `getReleases` and `getDigest` because their results
        // are considered final, whereas other cached methods are considered to work with intermediate values.
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
          if (!isUndefined(fallbackValue)) {
            logger.debug(
              { err },
              'Package cache decorator: callback error, returning old data',
            );
            return fallbackValue;
          }
          throw err;
        }

        // We cache `null` values but skip caching `undefined`.
        // An `undefined` result is treated as a potential transient failure
        // that should be retried on the next run.
        // The in-memory cache will still hold the `undefined` result for the duration
        // of the current run to avoid repeated calls within the same process.
        const value = { cachedAt: DateTime.local().toISO(), value: newValue };
        packageCache.memory.set(combinedKey, value);
        if (!isUndefined(newValue)) {
          await packageCache.setWithRawTtl(
            finalNamespace,
            cacheKey,
            value,
            hardTtlMinutes,
          );
        }

        return newValue;
      },
    );
  });
}
