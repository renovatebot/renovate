import { Minimatch, MinimatchOptions } from 'minimatch';

const cache = new Map<string, Minimatch>();

export function minimatch(
  pattern: string,
  options?: MinimatchOptions,
  useCache = true,
): Minimatch {
  const key = options ? `${pattern}:${JSON.stringify(options)}` : pattern;

  if (useCache) {
    const cachedResult = cache.get(key);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const instance = new Minimatch(pattern, options);
  if (useCache) {
    cache.set(key, instance);
  }
  return instance;
}
