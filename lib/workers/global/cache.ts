import { get as _get, put, rm as _rm } from 'cacache';
import { join } from 'path';
import { DateTime } from 'luxon';
import { logger } from '../../logger';

function getKey(namespace: string, key: string): string {
  return `${namespace}-${key}`;
}

let renovateCache: string;

// istanbul ignore next
async function rm(namespace: string, key: string): Promise<void> {
  logger.trace({ namespace, key }, 'Removing cache entry');
  await _rm.entry(renovateCache, getKey(namespace, key));
}

async function get<T = never>(namespace: string, key: string): Promise<T> {
  try {
    const res = await _get(renovateCache, getKey(namespace, key));
    const cachedValue = JSON.parse(res.data.toString());
    if (cachedValue) {
      if (DateTime.local() < DateTime.fromISO(cachedValue.expiry)) {
        logger.trace({ namespace, key }, 'Returning cached value');
        return cachedValue.value;
      }
      // istanbul ignore next
      await rm(namespace, key);
    }
  } catch (err) {
    logger.trace({ namespace, key }, 'Cache miss');
  }
  return null;
}

async function set(
  namespace: string,
  key: string,
  value: unknown,
  ttlMinutes = 5
): Promise<void> {
  logger.trace({ namespace, key, ttlMinutes }, 'Saving cached value');
  await put(
    renovateCache,
    getKey(namespace, key),
    JSON.stringify({
      value,
      expiry: DateTime.local().plus({ minutes: ttlMinutes }),
    })
  );
}

async function rmAll(): Promise<void> {
  await _rm.all(renovateCache);
}

export function init(cacheDir: string): void {
  renovateCache = join(cacheDir, '/renovate/renovate-cache-v1');
  logger.debug('Initializing Renovate internal cache into ' + renovateCache);
  global.renovateCache = global.renovateCache || { get, set, rm, rmAll };
}
