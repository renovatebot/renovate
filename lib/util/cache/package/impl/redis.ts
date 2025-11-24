import { DateTime } from 'luxon';
import type { RedisClusterOptions } from 'redis';
import { createClient, createCluster } from 'redis';
import { logger } from '../../../../logger';
import { compressToBase64, decompressFromBase64 } from '../../../compress';
import { regEx } from '../../../regex';
import type { PackageCacheNamespace } from '../types';
import { PackageCacheBase } from './base';

type RedisClient =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>;

export function normalizeRedisUrl(url: string): string {
  return url.replace(regEx(/^(rediss?)\+cluster:\/\//), '$1://');
}

export class PackageCacheRedis extends PackageCacheBase {
  static async create(url: string, prefix = ''): Promise<PackageCacheRedis> {
    if (!url) {
      throw new Error('Redis cache: URL must be provided');
    }

    logger.debug('Redis cache init');

    const rewrittenUrl = normalizeRedisUrl(url);
    // If any replacement was made, it means the regex matched and we are in clustered mode
    const clusteredMode = rewrittenUrl.length !== url.length;

    const config = {
      url: rewrittenUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          // Reconnect after this time
          return Math.min(retries * 100, 3000);
        },
      },
      pingInterval: 30000, // 30s
    };

    let client: RedisClient;
    if (clusteredMode) {
      const clusterConfig: RedisClusterOptions = { rootNodes: [config] };

      // only add defaults if username or password are present in the URL
      const parsedUrl = new URL(rewrittenUrl);
      if (parsedUrl.username) {
        clusterConfig.defaults = {
          username: parsedUrl.username,
        };
      }

      if (parsedUrl.password) {
        clusterConfig.defaults ??= {};
        clusterConfig.defaults.password = parsedUrl.password;
      }

      client = createCluster(clusterConfig);
    } else {
      client = createClient(config);
    }

    await client.connect();
    logger.debug('Redis cache connected');

    return new PackageCacheRedis(client, prefix);
  }

  private constructor(
    private readonly client: RedisClient,
    private readonly prefix: string,
  ) {
    super();
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    logger.trace(`cache.get(${namespace}, ${key})`);
    try {
      const res = await this.client.get(this.getKey(namespace, key));
      const cachedValue = res && JSON.parse(res);
      if (cachedValue) {
        if (DateTime.local() < DateTime.fromISO(cachedValue.expiry)) {
          logger.trace(
            { rprefix: this.prefix, namespace, key },
            'Returning cached value',
          );
          if (!cachedValue.compress) {
            return cachedValue.value;
          }
          const decompressed = await decompressFromBase64(cachedValue.value);
          return JSON.parse(decompressed);
        }
        await this.rm(namespace, key);
      }
    } catch {
      logger.trace({ rprefix: this.prefix, namespace, key }, 'Cache miss');
    }
    return undefined;
  }

  async set<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
    value: T,
    hardTtlMinutes: number,
  ): Promise<void> {
    logger.trace(
      { rprefix: this.prefix, namespace, key, hardTtlMinutes },
      'Saving cached value',
    );

    // Redis requires TTL to be integer, not float
    const redisTTL = Math.floor(hardTtlMinutes * 60);

    try {
      if (redisTTL <= 0) {
        await this.rm(namespace, key);
        return;
      }

      await this.client.set(
        this.getKey(namespace, key),
        JSON.stringify({
          compress: true,
          value: await compressToBase64(JSON.stringify(value)),
          expiry: DateTime.local().plus({ minutes: hardTtlMinutes }),
        }),
        { EX: redisTTL },
      );
    } catch (err) {
      logger.once.warn({ err }, 'Error while setting Redis cache value');
    }
  }

  override destroy(): Promise<void> {
    this.client.destroy();
    return Promise.resolve();
  }

  private getKey(namespace: PackageCacheNamespace, key: string): string {
    return `${this.prefix}${namespace}-${key}`;
  }

  private async rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace(
      { rprefix: this.prefix, namespace, key },
      'Removing cache entry',
    );
    await this.client.del(this.getKey(namespace, key));
  }
}
