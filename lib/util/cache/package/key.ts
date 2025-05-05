import type { CombinedKey, PackageCacheNamespace } from './types';

/**
 * Returns the key used by underlying storage implementations
 */
export function getCombinedKey(
  namespace: PackageCacheNamespace,
  key: string,
): CombinedKey {
  return `datasource-mem-cache:package-cache-memoization:${namespace}:${key}`;
}
