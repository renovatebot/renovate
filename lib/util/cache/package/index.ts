import type { AllConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { regEx } from '../../regex';
import * as memCache from '../memory';
import * as fileCache from './file';
import * as redisCache from './redis';
import type { PackageCache } from './types';

let cacheProxy: PackageCache;

const nullableString = regEx('undefined|null');

function getGlobalKey(namespace: string, key: string): string {
  const result = `global%%${namespace}%%${key}`;
  // istanbul ignore if
  if (namespace === '' || key === '' || result.match(nullableString)) {
    logger.warn(
      { namespace, key, globalKey: result },
      `Package cache: potentially wrong cache key`
    );
  }

  return result;
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

export function init(config: AllConfig): void {
  if (config.redisUrl) {
    redisCache.init(config.redisUrl);
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

export function cleanup(config: AllConfig): void {
  if (config?.redisUrl) {
    redisCache.end();
  }
}
