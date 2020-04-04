export async function cacheAble<T = any>(
  id: string,
  lookup: any,
  func: any,
  minutes: number
): Promise<T> {
  const cacheNamespace = `datasource-${id}`;
  const cacheKey = JSON.stringify(lookup);
  const cachedResult = await renovateCache.get<T>(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const res = await func(lookup);
  await renovateCache.set(cacheNamespace, cacheKey, res, minutes);
  return res;
}
