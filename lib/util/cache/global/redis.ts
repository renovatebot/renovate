/* istanbul ignore file */
import { createHandyClient, IHandyRedis } from 'handy-redis';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';

let client: IHandyRedis | undefined;

function getKey(namespace: string, key: string): string {
  return `${namespace}-${key}`;
}

export async function end(): Promise<void> {
  try {
    await client?.end(true);
  } catch (err) {
    logger.warn({ err }, 'Redis cache end failed');
  }
}

async function rm(namespace: string, key: string): Promise<void> {
  logger.trace({ namespace, key }, 'Removing cache entry');
  await client?.del(getKey(namespace, key));
}

async function get<T = never>(namespace: string, key: string): Promise<T> {
  logger.trace(`cache.get(${namespace}, ${key})`);
  try {
    const res = await client?.get(getKey(namespace, key));
    const cachedValue = JSON.parse(res);
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
  await client?.set(
    getKey(namespace, key),
    JSON.stringify({
      value,
      expiry: DateTime.local().plus({ minutes: ttlMinutes }),
    }),
    'EX',
    ttlMinutes * 60
  );
}

export function init(url: string): void {
  if (!url) {
    return;
  }
  logger.debug('Redis cache init');
  client = createHandyClient({
    url,
    retry_strategy: (options) => {
      if (options.error) {
        logger.error({ err: options.error }, 'Redis cache error');
      }
      // Reconnect after this time
      return Math.min(options.attempt * 100, 3000);
    },
  });
  global.renovateCache = { get, set, rm };
}
