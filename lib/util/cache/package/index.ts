import type { AllConfig } from '../../../config/types';
import { PackageCacheStats } from '../../stats';
import * as memCache from '../memory';
import * as fileCache from './file';
import { getCombinedKey } from './key';
import * as redisCache from './redis';
import { SqlitePackageCache } from './sqlite';
import type { PackageCache, PackageCacheNamespace } from './types';

let cacheProxy: PackageCache | undefined;

export async function get<T = any>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  if (!cacheProxy) {
    return undefined;
  }

  const combinedKey = getCombinedKey(namespace, key);
  let p = memCache.get(combinedKey);
  if (!p) {
    p = PackageCacheStats.wrapGet(() =>
      cacheProxy!.get<number[]>(namespace, key),
    );
    memCache.set(combinedKey, p);
  }

  const result = await p;
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

  await PackageCacheStats.wrapSet(() =>
    cacheProxy!.set(namespace, key, value, minutes),
  );

  const combinedKey = getCombinedKey(namespace, key);
  const p = Promise.resolve(value);
  memCache.set(combinedKey, p);
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
