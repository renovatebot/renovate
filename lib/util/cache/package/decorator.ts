import { isString } from '@sindresorhus/is';
import type { Decorator } from '../../decorator/index.ts';
import { decorate } from '../../decorator/index.ts';
import { cached } from './cached.ts';
import type { PackageCacheNamespace } from './types.ts';

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
    const finalNamespace = isString(namespace)
      ? namespace
      : namespace.apply(instance, args);

    const finalKey = isString(key) ? key : key.apply(instance, args);

    // istanbul ignore if
    if (!finalNamespace || !finalKey) {
      return callback();
    }

    return await cached(
      {
        namespace: finalNamespace,
        key: finalKey,
        ttlMinutes,
        cacheable: cacheable.apply(instance, args),
        fallback: methodName === 'getReleases' || methodName === 'getDigest',
      },
      callback,
    );
  });
}
