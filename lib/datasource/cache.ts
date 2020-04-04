import { logger } from '../logger';

export type CacheLoadCallback<TArg, TResult> = (
  lookup: TArg
) => Promise<TResult>;

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
  cb: CacheLoadCallback<TArg, { data: TResult; isPrivate?: boolean }>;
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
  cb: func,
  minutes = 60,
}: CacheConfig<TArg, TResult>): Promise<TResult> {
  const cacheNamespace = `datasource-${id}`;
  const cacheKey = JSON.stringify(lookup);
  const cachedResult = await renovateCache.get<TResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    logger.trace({ id, lookup }, 'datasource cachedResult');
    return cachedResult;
  }
  const { data, isPrivate } = await func(lookup);
  // istanbul ignore if
  if (isPrivate) {
    logger.trace({ id, lookup }, 'Skipping datasource cache for private data');
  } else {
    await renovateCache.set(cacheNamespace, cacheKey, data, minutes);
  }
  return data;
}
