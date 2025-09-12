import is from '@sindresorhus/is';
import { createClient, createCluster } from 'redis';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { outputCacheFile } from '../../../fs';
import { normalizeRedisUrl } from '../../package/redis';
import { getLocalCacheFileName } from '../common';
import type { RepoCacheRecord } from '../schema';
import { RepoCacheBase } from './base';

type RedisType =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>
  | null;

const NAMESPACE = 'repository';

export class RepoCacheRedis extends RepoCacheBase {
  private redisClient: RedisType;
  private readonly url;

  constructor(repository: string, fingerprint: string, url: string) {
    super(repository, fingerprint);
    this.url = url;
    this.redisClient = null;
  }

  async read(): Promise<string | null> {
    this.redisClient ??= await this.getRedisClient();
    const cacheKey = this.getCacheKey();
    try {
      return (await this.redisClient?.get(cacheKey)) ?? null;
    } catch {
      logger.debug({ cacheKey }, 'Repository cache not found');
      return null;
    }
  }

  async write(data: RepoCacheRecord): Promise<void> {
    this.redisClient ??= await this.getRedisClient();
    const stringifiedCache = JSON.stringify(data);
    const ttlDays = GlobalConfig.get('httpCacheTtlDays', 90);
    try {
      await this.redisClient?.set(this.getCacheKey(), stringifiedCache, {
        EX: ttlDays * 24 * 60 * 60,
      });
      if (is.nonEmptyString(process.env.RENOVATE_X_REPO_CACHE_FORCE_LOCAL)) {
        const cacheLocalFileName = getLocalCacheFileName(
          this.platform,
          this.repository,
        );
        await outputCacheFile(cacheLocalFileName, stringifiedCache);
      }
    } catch (err) {
      logger.once.warn({ err }, 'Error while setting Redis cache value');
    }
  }

  override async cleanup(): Promise<void> {
    try {
      // https://github.com/redis/node-redis#disconnecting
      await this.redisClient?.disconnect();
    } catch (err) {
      logger.warn({ err }, 'Redis repository cache end failed');
    }
  }

  protected getCacheKey(): string {
    return [NAMESPACE, this.platform, this.repository].join('.');
  }

  private async getRedisClient(): Promise<RedisType> {
    const rewrittenUrl = normalizeRedisUrl(this.url);
    // If any replacement was made, it means the regex matched and we are in clustered mode
    const clusteredMode = rewrittenUrl.length !== this.url.length;

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

    const redisClient = clusteredMode
      ? createCluster({ rootNodes: [config] })
      : createClient(config);

    await redisClient.connect();
    return redisClient;
  }
}
