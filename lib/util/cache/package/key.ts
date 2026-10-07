import type { CombinedKey, PackageCacheNamespace } from './types.ts';

/**
 * Returns the key used by underlying storage implementations
 */
export function getCombinedKey(
  namespace: PackageCacheNamespace,
  key: string,
): CombinedKey {
  return `datasource-mem:pkg-fetch:${namespace}:${key}`;
}

/**
 * Joins all given parts with `:`, using an empty string for `undefined` and `null` parts.
 * Parts are joined as-is, without escaping `:` inside a part.
 */
export function buildCacheKey(
  ...parts: (string | number | null | undefined)[]
): string {
  return parts.map((part) => part ?? '').join(':');
}
