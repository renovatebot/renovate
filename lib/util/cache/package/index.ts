import type { AllConfig } from '../../../config/types';
import * as memCache from '../memory';
import * as fileCache from './file';
import * as redisCache from './redis';
import { SqlitePackageCache } from './sqlite';
import type { PackageCache, PackageCacheNamespace } from './types';

let cacheProxy: PackageCache | undefined;

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export async function get<T = any>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  let start = 0;
  if (memCache.get(globalKey) === undefined) {
    memCache.set(globalKey, cacheProxy.get(namespace, key));
    start = Date.now();
  }
  const result = await memCache.get(globalKey);
  if (start) {
    // Only count duration if it's not a duplicate
    const durationMs = Math.round(Date.now() - start);
    const cacheDurations = memCache.get<number[]>('package-cache-gets') ?? [];
    cacheDurations.push(durationMs);
    memCache.set('package-cache-gets', cacheDurations);
  }
  return result;
}

export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  minutes: number,
): Promise<void> {
  if (!cacheProxy) {
    return;
  }
  const globalKey = getGlobalKey(namespace, key);
  memCache.set(globalKey, value);
  const start = Date.now();
  await cacheProxy.set(namespace, key, value, minutes);
  const durationMs = Math.round(Date.now() - start);
  const cacheDurations = memCache.get<number[]>('package-cache-sets') ?? [];
  cacheDurations.push(durationMs);
  memCache.set('package-cache-sets', cacheDurations);
}

export async function init(config: AllConfig): Promise<void> {
  if (config.redisUrl) {
    await redisCache.init(config.redisUrl, config.redisPrefix);
    cacheProxy = {
      get: redisCache.get,
      set: redisCache.set,
    };
    return;
  }

  if (process.env.RENOVATE_X_SQLITE_PACKAGE_CACHE) {
    cacheProxy = await SqlitePackageCache.init(config.cacheDir!);
    return;
  }

  if (config.cacheDir) {
    fileCache.init(config.cacheDir);
    cacheProxy = {
      get: fileCache.get,
      set: fileCache.set,
      cleanup: fileCache.cleanup,
    };
    return;
  }
}

export async function cleanup(config: AllConfig): Promise<void> {
  if (config?.redisUrl) {
    await redisCache.end();
  }
  if (cacheProxy?.cleanup) {
    await cacheProxy.cleanup();
  }
}
