import type { MinimatchOptions } from 'minimatch';
import { Minimatch } from 'minimatch';

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

export function minimatchFilter(
  pattern: string,
  options?: MinimatchOptions,
  useCache = true,
): (fileName: string) => boolean {
  const key = options ? `${pattern}:${JSON.stringify(options)}` : pattern;

  if (useCache) {
    const cachedResult = cache.get(key);
    if (cachedResult) {
      return (fileName) => cachedResult.match(fileName);
    }
  }

  const instance = new Minimatch(pattern, options);
  if (useCache) {
    cache.set(key, instance);
  }
  return (fileName) => instance.match(fileName);
}
