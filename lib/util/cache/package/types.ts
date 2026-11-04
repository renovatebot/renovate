export type { CombinedKey, PackageCacheNamespace } from './namespaces.ts';

export interface CachedRecord {
  value: unknown;
  cachedAt: string;
}
