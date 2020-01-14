import os from 'os';
import * as cacache from 'cacache';
import path from 'path';
import { DateTime } from 'luxon';
import { logger } from '../../logger';

function getKey(namespace: string, key: string): string {
  return `${namespace}-${key}`;
}

let renovateCache: string;

async function rm(namespace: string, key: string): Promise<void> {
  logger.trace({ namespace, key }, 'Removing cache entry');
  await cacache.rm.entry(renovateCache, getKey(namespace, key));
}

async function get<T = never>(namespace: string, key: string): Promise<T> {
  try {
    const res = await cacache.get(renovateCache, getKey(namespace, key));
    const cachedValue = JSON.parse(res.data.toString());
    // istanbul ignore else: only happens when cache is corrupted
    if (cachedValue) {
      if (DateTime.local() < DateTime.fromISO(cachedValue.expiry)) {
        logger.trace({ namespace, key }, 'Returning cached value');
        return cachedValue.value;
      }
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
  await cacache.put(
    renovateCache,
    getKey(namespace, key),
    JSON.stringify({
      value,
      expiry: DateTime.local().plus({ minutes: ttlMinutes }),
    })
  );
}

async function rmAll(): Promise<void> {
  await cacache.rm.all(renovateCache);
}

export function init(cacheDir: string): void {
  renovateCache = path.join(cacheDir, '/renovate/renovate-cache-v1');
  logger.debug('Initializing Renovate internal cache into ' + renovateCache);
  global.renovateCache = global.renovateCache || { get, set, rm, rmAll };
}

init(os.tmpdir()); // Use default temporary dir to begin with
