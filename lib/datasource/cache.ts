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
  cb: CacheLoadCallback<TArg, TResult>;
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
    return cachedResult;
  }
  const res = await func(lookup);
  await renovateCache.set(cacheNamespace, cacheKey, res, minutes);
  return res;
}
