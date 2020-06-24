import { RenovateConfig } from '../../../config/common';
import * as runCache from '../run';
import { GlobalCache } from './common';
import * as fileCache from './file';
import * as redisCache from './redis';

let cacheProxy: GlobalCache;

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export function get<T = any>(namespace: string, key: string): Promise<T> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  if (!runCache.get(globalKey)) {
    runCache.set(globalKey, cacheProxy.get(namespace, key));
  }
  return runCache.get(globalKey);
}

export function set(
  namespace: string,
  key: string,
  value: any,
  minutes: number
): Promise<void> {
  if (!cacheProxy) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  runCache.set(globalKey, value);
  return cacheProxy.set(namespace, key, value, minutes);
}

export function init(config: RenovateConfig): void {
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

export function cleanup(config: RenovateConfig): void {
  if (config.redisUrl) {
    redisCache.end();
  }
}
