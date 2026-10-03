import { LRUCache } from 'lru-cache';
import type { AllConfig } from '../../../config/types.ts';
import { DEFAULT_PACKAGE_CACHE_MEMORY_LIMIT } from '../../../constants/cache.ts';
import { logger } from '../../../logger/index.ts';
import * as backend from './backend.ts';
import { type MemoryEntry, PackageCache } from './package-cache.ts';
import type { PackageCacheNamespace } from './types.ts';

export { PackageCache } from './package-cache.ts';

export let packageCache = new PackageCache(undefined, null);

export function getCacheType(): ReturnType<typeof backend.getCacheType> {
  return backend.getCacheType();
}

export async function get<T = any>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  return await packageCache.get<T>(namespace, key);
}

/**
 * Set cache value with user-defined TTL overrides.
 */
export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  await packageCache.set(namespace, key, value, hardTtlMinutes);
}

/**
 * Set cache value ignoring user-defined TTL overrides.
 * This MUST NOT be used outside of cache implementation
 */
export async function setWithRawTtl(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  await packageCache.setWithRawTtl(namespace, key, value, hardTtlMinutes);
}

export async function init(config: AllConfig): Promise<void> {
  const memoryLimit =
    config.packageCacheMemoryLimit ?? DEFAULT_PACKAGE_CACHE_MEMORY_LIMIT;
  const maxSize = memoryLimit * 1024 ** 2;
  if (
    !Number.isSafeInteger(memoryLimit) ||
    memoryLimit < 0 ||
    !Number.isSafeInteger(maxSize)
  ) {
    throw new Error(
      'packageCacheMemoryLimit must be a non-negative integer in MiB',
    );
  }

  const memory =
    maxSize > 0 ? new LRUCache<string, MemoryEntry>({ maxSize }) : null;
  await backend.init(config);
  packageCache = new PackageCache(backend.getBackend(), memory);
}

export async function cleanup(_config: AllConfig): Promise<void> {
  try {
    packageCache.softReset();
    await backend.destroy();
  } catch (err) {
    logger.warn({ err }, 'Package cache destroy failed');
  } finally {
    packageCache = new PackageCache(undefined, null);
  }
}
