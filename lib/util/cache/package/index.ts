import type { GlobalConfig } from '../../../config/types';
import * as memCache from '../memory';
import type { PackageCache } from './common';
import * as fileCache from './file';
import * as redisCache from './redis';

let cacheProxy: PackageCache;

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export function get<T = any>(namespace: string, key: string): Promise<T> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  if (!memCache.get(globalKey)) {
    memCache.set(globalKey, cacheProxy.get(namespace, key));
  }
  return memCache.get(globalKey);
}

export function set(
  namespace: string,
  key: string,
  value: unknown,
  minutes: number
): Promise<void> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  memCache.set(globalKey, value);
  return cacheProxy.set(namespace, key, value, minutes);
}

export function init(config: GlobalConfig): void {
  if (config.redisUrl) {
    redisCache.init(config.redisUrl);
    cacheProxy = {
      get: redisCache.get,
      set: redisCache.set,
    };
  } else {
    fileCache.init(config.cacheDir);
    cacheProxy = {
      get: fileCache.get,
      set: fileCache.set,
    };
  }
}

export function cleanup(config: GlobalConfig): void {
  if (config?.redisUrl) {
    redisCache.end();
  }
}
