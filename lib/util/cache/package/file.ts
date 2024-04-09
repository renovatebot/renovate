import cacache from 'cacache';
import { DateTime } from 'luxon';
import upath from 'upath';
import { logger } from '../../../logger';
import { compressToBase64, decompressFromBase64 } from '../../compress';
import type { PackageCacheNamespace } from './types';

function getKey(namespace: PackageCacheNamespace, key: string): string {
  return `${namespace}-${key}`;
}

let cacheFileName: string;

async function rm(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<void> {
  logger.trace({ namespace, key }, 'Removing cache entry');
  await cacache.rm.entry(cacheFileName, getKey(namespace, key));
}

export async function get<T = never>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  if (!cacheFileName) {
    return undefined;
  }
  try {
    const res = await cacache.get(cacheFileName, getKey(namespace, key));
    const cachedValue = JSON.parse(res.data.toString());
    if (cachedValue) {
      if (DateTime.local() < DateTime.fromISO(cachedValue.expiry)) {
        logger.trace({ namespace, key }, 'Returning cached value');
        // istanbul ignore if
        if (!cachedValue.compress) {
          return cachedValue.value;
        }
        const res = await decompressFromBase64(cachedValue.value);
        return JSON.parse(res);
      }
      await rm(namespace, key);
    }
  } catch (err) {
    logger.trace({ namespace, key }, 'Cache miss');
  }
  return undefined;
}

export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  ttlMinutes = 5,
): Promise<void> {
  if (!cacheFileName) {
    return;
  }
  logger.trace({ namespace, key, ttlMinutes }, 'Saving cached value');
  await cacache.put(
    cacheFileName,
    getKey(namespace, key),
    JSON.stringify({
      compress: true,
      value: await compressToBase64(JSON.stringify(value)),
      expiry: DateTime.local().plus({ minutes: ttlMinutes }),
    }),
  );
}

export function init(cacheDir: string): string {
  cacheFileName = upath.join(cacheDir, '/renovate/renovate-cache-v1');
  logger.debug('Initializing Renovate internal cache into ' + cacheFileName);
  return cacheFileName;
}

export async function cleanup(): Promise<void> {
  logger.debug('Checking file package cache for expired items');
  try {
    let totalCount = 0;
    let deletedCount = 0;
    const startTime = Date.now();
    for await (const item of cacache.ls.stream(cacheFileName)) {
      totalCount += 1;
      const cachedItem = item as unknown as cacache.CacheObject;
      const res = await cacache.get(cacheFileName, cachedItem.key);
      let cachedValue: any;
      try {
        cachedValue = JSON.parse(res.data.toString());
      } catch (err) {
        logger.debug('Error parsing cached value - deleting');
      }
      if (
        !cachedValue ||
        (cachedValue?.expiry &&
          DateTime.local() > DateTime.fromISO(cachedValue.expiry))
      ) {
        await cacache.rm.entry(cacheFileName, cachedItem.key);
        deletedCount += 1;
      }
    }
    logger.debug(`Verifying and cleaning cache: ${cacheFileName}`);
    await cacache.verify(cacheFileName);
    const durationMs = Math.round(Date.now() - startTime);
    logger.debug(
      `Deleted ${deletedCount} of ${totalCount} file cached entries in ${durationMs}ms`,
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error cleaning up expired file cache');
  }
}
