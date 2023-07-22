import { Minimatch, MinimatchOptions } from 'minimatch';

const cache = new Map<string, Minimatch>();

export function minimatch(
  pattern: string,
  options?: MinimatchOptions,
  useCache = true
): Minimatch {
  const canBeCached = useCache;

  const key = `${pattern.toString()}`;
  if (canBeCached) {
    const cachedResult = cache.get(key);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const instance = new Minimatch(pattern, options);
  if (canBeCached) {
    cache.set(key, instance);
  }
  return instance;
}
