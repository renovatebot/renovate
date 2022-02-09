import type { AllConfig } from '../../../config/types';
import * as memCache from '../memory';
import * as fileCache from './file';
import * as redisCache from './redis';
import type { PackageCache } from './types';

let cacheProxy: PackageCache;

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export async function get<T = any>(
  namespace: string,
  key: string
): Promise<T | undefined> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  if (memCache.get(globalKey) === undefined) {
    memCache.set(globalKey, cacheProxy.get(namespace, key));
  }
  const result = await memCache.get(globalKey);
  return result;
}

export async function set(
  namespace: string,
  key: string,
  value: unknown,
  minutes: number
): Promise<void> {
  if (!cacheProxy) {
    return;
  }
  const globalKey = getGlobalKey(namespace, key);
  memCache.set(globalKey, value);
  await cacheProxy.set(namespace, key, value, minutes);
}

export async function init(config: AllConfig): Promise<void> {
  if (config.redisUrl) {
    await redisCache.init(config.redisUrl);
    cacheProxy = {
      get: redisCache.get,
      set: redisCache.set,
    };
  } else if (config.cacheDir) {
    fileCache.init(config.cacheDir);
    cacheProxy = {
      get: fileCache.get,
      set: fileCache.set,
    };
  }
}

export async function cleanup(config: AllConfig): Promise<void> {
  if (config?.redisUrl) {
    await redisCache.end();
  }
}
