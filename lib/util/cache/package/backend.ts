import type { AllConfig } from '../../../config/types.ts';
import { getEnv } from '../../env.ts';
import type { PackageCacheBase } from './impl/base.ts';
import { PackageCacheFile } from './impl/file.ts';
import { PackageCacheRedis } from './impl/redis.ts';
import { PackageCacheSqlite } from './impl/sqlite.ts';
import type { PackageCacheNamespace } from './types.ts';

let cacheBackend: PackageCacheBase | undefined;
let cacheType: 'redis' | 'sqlite' | 'file' | undefined;

export function getCacheType(): typeof cacheType {
  return cacheType;
}

export function getBackend(): PackageCacheBase | undefined {
  return cacheBackend;
}

export async function init(config: AllConfig): Promise<void> {
  await destroy();

  if (config.redisUrl) {
    cacheBackend = await PackageCacheRedis.create(
      config.redisUrl,
      config.redisPrefix,
    );
    cacheType = 'redis';
    return;
  }

  if (getEnv().RENOVATE_X_SQLITE_PACKAGE_CACHE && config.cacheDir) {
    cacheBackend = await PackageCacheSqlite.create(config.cacheDir);
    cacheType = 'sqlite';
    return;
  }

  if (config.cacheDir) {
    cacheBackend = PackageCacheFile.create(config.cacheDir);
    cacheType = 'file';
    return;
  }
}

export async function get<T = unknown>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  return await cacheBackend?.get<T>(namespace, key);
}

export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  await cacheBackend?.set(namespace, key, value, hardTtlMinutes);
}

export async function destroy(): Promise<void> {
  cacheType = undefined;
  try {
    await cacheBackend?.destroy();
  } finally {
    cacheBackend = undefined;
  }
}
