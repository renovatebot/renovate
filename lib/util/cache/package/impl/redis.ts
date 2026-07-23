import type { RedisClusterOptions } from '@redis/client';
import { RESP_TYPES, createClient, createCluster } from '@redis/client';
import { logger } from '../../../../logger/index.ts';
import { regEx } from '../../../regex.ts';
import { parseUrl } from '../../../url.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

export function normalizeRedisUrl(url: string): string {
  return url.replace(regEx(/^(rediss?)\+cluster:\/\//), '$1://');
}

type RedisClient =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>;

interface RedisBinaryClient {
  get(key: string): Promise<Buffer | null>;
}

export class PackageCacheRedis extends PackageCacheBase {
  static async create(
    url: string,
    prefix: string | undefined,
  ): Promise<PackageCacheRedis> {
    const rprefix = prefix ?? '';
    logger.debug('Redis cache init');

    const rewrittenUrl = normalizeRedisUrl(url);
    const clusteredMode = rewrittenUrl !== url;

    const config = {
      url: rewrittenUrl,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 100, 3000),
      },
      pingInterval: 30000,
    };

    let client: RedisClient;

    if (clusteredMode) {
      const clusterConfig: RedisClusterOptions = { rootNodes: [config] };

      const parsedUrl = parseUrl(rewrittenUrl);
      if (parsedUrl?.username) {
        clusterConfig.defaults = {
          username: parsedUrl.username,
        };
      }

      if (parsedUrl?.password) {
        clusterConfig.defaults ??= {};
        clusterConfig.defaults.password = parsedUrl.password;
      }

      client = createCluster(clusterConfig);
    } else {
      client = createClient(config);
    }

    await client.connect();
    logger.debug('Redis cache connected');
    const binaryClient = client.withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer,
    }) as RedisBinaryClient;
    return new PackageCacheRedis(client, binaryClient, rprefix);
  }

  private readonly client: RedisClient;
  private readonly binaryClient: RedisBinaryClient;
  private readonly rprefix: string;

  private constructor(
    client: RedisClient,
    binaryClient: RedisBinaryClient,
    rprefix: string,
  ) {
    super();
    this.client = client;
    this.binaryClient = binaryClient;
    this.rprefix = rprefix;
  }

  private getKey(namespace: PackageCacheNamespace, key: string): string {
    return `${this.rprefix}${namespace}-${key}`;
  }

  override destroy(): Promise<void> {
    try {
      // https://github.com/redis/node-redis#disconnecting
      this.client.destroy();
    } catch (err) {
      logger.warn({ err }, 'Redis cache destroy failed');
    }
    return Promise.resolve();
  }

  protected override async readRaw(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<Buffer | undefined> {
    const raw = await this.binaryClient.get(this.getKey(namespace, key));

    return raw ?? undefined;
  }

  protected override async writeRaw(
    namespace: PackageCacheNamespace,
    key: string,
    data: Buffer,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(this.getKey(namespace, key), data, {
      EX: ttlSeconds,
    });
  }

  protected override async rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    logger.trace(
      { rprefix: this.rprefix, namespace, key },
      'Removing cache entry',
    );
    await this.client.del(this.getKey(namespace, key));
  }
}
