import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { Decorator, decorate } from '../../decorator';
import type { DecoratorCachedRecord } from './types';
import * as packageCache from '.';

type HashFunction<T extends any[] = any[]> = (...args: T) => string;
type BooleanFunction<T extends any[] = any[]> = (...args: T) => boolean;

/**
 * The cache decorator parameters.
 */
interface CacheParameters {
  /**
   * The cache namespace
   * Either a string or a hash function that generates a string
   */
  namespace: string | HashFunction;

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
  return decorate(async ({ args, instance, callback }) => {
    if (!cacheable.apply(instance, args)) {
      return callback();
    }

    let finalNamespace: string | undefined;
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
    const cacheRecord = await packageCache.get<DecoratorCachedRecord<T>>(
      finalNamespace,
      finalKey
    );

    const now = DateTime.local();
    const hardTTLMinutes = ttlMinutes * 10;

    if (cacheRecord) {
      const ttlDeadline = DateTime.fromISO(cacheRecord.cachedAt).plus({
        minutes: ttlMinutes,
      });
      if (now < ttlDeadline) {
        return cacheRecord.data;
      }
    }

    let data: T | undefined;
    try {
      data = (await callback()) as T | undefined;
    } catch (err) {
      if (cacheRecord) {
        return cacheRecord.data;
      }
    } finally {
      if (!is.undefined(data)) {
        const cachedAt = now.toISO();
        await packageCache.set(
          finalNamespace,
          finalKey,
          { data, cachedAt },
          hardTTLMinutes
        );
      }
    }

    return data;
  });
}
