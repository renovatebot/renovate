import type { AllConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import * as backend from './backend.ts';
import { PackageCache } from './package-cache.ts';
import type { PackageCacheNamespace } from './types.ts';

export { PackageCache } from './package-cache.ts';

export let packageCache = new PackageCache();

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
  await backend.init(config);
  packageCache = new PackageCache(backend.getBackend());
}

export async function cleanup(_config: AllConfig): Promise<void> {
  try {
    await packageCache.destroy();
  } catch (err) {
    logger.warn({ err }, 'Package cache destroy failed');
  }
  packageCache = new PackageCache();
}
