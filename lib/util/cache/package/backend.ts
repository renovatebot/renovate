import type { AllConfig } from '../../../config/types.ts';
import { getEnv } from '../../env.ts';
import type { PackageCacheBase } from './impl/base.ts';
import { PackageCacheFile } from './impl/file.ts';
import { PackageCacheRedis } from './impl/redis.ts';
import { PackageCacheSqlite } from './impl/sqlite.ts';
import type { PackageCacheNamespace } from './types.ts';

let cacheProxy: PackageCacheBase | undefined;
let cacheType: 'redis' | 'sqlite' | 'file' | undefined;

export function getCacheType(): typeof cacheType {
  return cacheType;
}

export async function init(config: AllConfig): Promise<void> {
  await destroy();

  if (config.redisUrl) {
    cacheProxy = await PackageCacheRedis.create(
      config.redisUrl,
      config.redisPrefix,
    );
    cacheType = 'redis';
    return;
  }

  if (getEnv().RENOVATE_X_SQLITE_PACKAGE_CACHE && config.cacheDir) {
    cacheProxy = await PackageCacheSqlite.create(config.cacheDir);
    cacheType = 'sqlite';
    return;
  }

  if (config.cacheDir) {
    cacheProxy = PackageCacheFile.create(config.cacheDir);
    cacheType = 'file';
    return;
  }
}

export async function get<T = unknown>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  return await cacheProxy?.get<T>(namespace, key);
}

export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  await cacheProxy?.set(namespace, key, value, hardTtlMinutes);
}

export async function destroy(): Promise<void> {
  cacheType = undefined;
  try {
    await cacheProxy?.destroy();
  } finally {
    cacheProxy = undefined;
  }
}
