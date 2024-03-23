import type { AllConfig } from '../../../config/types';
import { PackageCacheStats } from '../../stats';
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
  let p = memCache.get(globalKey);
  if (!p) {
    p = PackageCacheStats.wrapGet(() =>
      cacheProxy!.get<number[]>(namespace, key),
    );
    memCache.set(globalKey, p);
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

  const globalKey = getGlobalKey(namespace, key);
  const p = Promise.resolve(value);
  memCache.set(globalKey, p);
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
