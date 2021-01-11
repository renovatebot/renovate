/* istanbul ignore file */
import { WrappedNodeRedisClient, createNodeRedisClient } from 'handy-redis';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';

let client: WrappedNodeRedisClient | undefined;

function getKey(namespace: string, key: string): string {
  return `${namespace}-${key}`;
}

export function end(): void {
  try {
    client?.nodeRedis?.end(true); // TODO: Why is this not supported by client directly?
  } catch (err) {
    logger.warn({ err }, 'Redis cache end failed');
  }
}

async function rm(namespace: string, key: string): Promise<void> {
  logger.trace({ namespace, key }, 'Removing cache entry');
  await client?.del(getKey(namespace, key));
}

export async function get<T = never>(
  namespace: string,
  key: string
): Promise<T> {
  if (!client) {
    return undefined;
  }
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
  return undefined;
}

export async function set(
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
    ['EX', ttlMinutes * 60]
  );
}

export function init(url: string): void {
  if (!url) {
    return;
  }
  logger.debug('Redis cache init');
  client = createNodeRedisClient({
    url,
    retry_strategy: (options) => {
      if (options.error) {
        logger.error({ err: options.error }, 'Redis cache error');
      }
      // Reconnect after this time
      return Math.min(options.attempt * 100, 3000);
    },
  });
}
