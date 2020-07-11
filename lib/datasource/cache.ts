import { logger } from '../logger';
import * as packageCache from '../util/cache/package';

/**
 * Cache callback result which has to be returned by the `CacheCallback` function.
 */
export interface CacheResult<TResult = unknown> {
  /**
   * The data which should be added to the cache
   */
  data: TResult;
  /**
   * `data` can only be cached if this is not `true`
   */
  isPrivate?: boolean;
}

/**
 * Simple helper type for defining the `CacheCallback` function return type
 */
export type CachePromise<TResult = unknown> = Promise<CacheResult<TResult>>;

/**
 * The callback function which is called on cache miss.
 */
export type CacheCallback<TArg, TResult = unknown> = (
  lookup: TArg
) => CachePromise<TResult>;

export type CacheConfig<TArg, TResult> = {
  /**
   * Datasource id
   */
  id: string;
  /**
   * Cache key
   */
  lookup: TArg;
  /**
   * Callback to use on cache miss to load result
   */
  cb: CacheCallback<TArg, TResult>;
  /**
   * Time to cache result in minutes
   */
  minutes?: number;
};

/**
 * Loads result from cache or from passed callback on cache miss.
 * @param param0 Cache config args
 */
export async function cacheAble<TArg, TResult = unknown>({
  id,
  lookup,
  cb,
  minutes = 60,
}: CacheConfig<TArg, TResult>): Promise<TResult> {
  const cacheNamespace = `datasource-${id}`;
  const cacheKey = JSON.stringify(lookup);
  const cachedResult = await packageCache.get<TResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    logger.trace({ id, lookup }, 'datasource cachedResult');
    return cachedResult;
  }
  const { data, isPrivate } = await cb(lookup);
  // istanbul ignore if
  if (isPrivate) {
    logger.trace({ id, lookup }, 'Skipping datasource cache for private data');
  } else {
    await packageCache.set(cacheNamespace, cacheKey, data, minutes);
  }
  return data;
}
