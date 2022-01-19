/* istanbul ignore file */
import { DateTime } from 'luxon';
import { createClient } from 'redis';
import { logger } from '../../../logger';

let client: ReturnType<typeof createClient> | undefined;

function getKey(namespace: string, key: string): string {
  return `${namespace}-${key}`;
}

export async function end(): Promise<void> {
  try {
    // https://github.com/redis/node-redis#disconnecting
    await client?.disconnect();
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
): Promise<T | undefined> {
  if (!client) {
    return undefined;
  }
  logger.trace(`cache.get(${namespace}, ${key})`);
  try {
    const res = await client?.get(getKey(namespace, key));
    const cachedValue = res && JSON.parse(res);
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
    { EX: ttlMinutes * 60 }
  );
}

export async function init(url: string): Promise<void> {
  if (!url) {
    return;
  }
  logger.debug('Redis cache init');
  client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        // Reconnect after this time
        return Math.min(retries * 100, 3000);
      },
    },
  });
  await client.connect();
}
