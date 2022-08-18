import is from '@sindresorhus/is';
import { Decorator, decorate } from '../../decorator';
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

    const cachedResult = await packageCache.get<unknown>(
      finalNamespace,
      finalKey
    );

    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const result = await callback();

    // only cache if we got a valid result
    if (result !== undefined) {
      await packageCache.set(finalNamespace, finalKey, result, ttlMinutes);
    }
    return result;
  });
}
