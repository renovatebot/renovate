import { createClient } from 'redis';
import { logger } from '../../../../logger';
import { RepoCacheBase } from './base';

let client: ReturnType<typeof createClient> | undefined;

const NAMESPACE = 'repository';

export class RedisRepoCache extends RepoCacheBase {
  constructor(private platform: string, repository: string) {
    super(repository);
  }

  protected getCacheKey(): string {
    return [NAMESPACE, this.platform, this.repository].join('.');
  }

  protected async readFromCache(): Promise<string | undefined> {
    const cacheKey = this.getCacheKey();
    try {
      return (await client?.get(cacheKey)) ?? undefined;
    } catch (err) {
      logger.debug({ cacheKey }, 'Repository cache not found');
      return undefined;
    }
  }

  protected async writeToCache(data: string): Promise<void> {
    await client?.set(this.getCacheKey(), data);
  }
}

export async function initRedisClient(url: string): Promise<void> {
  if (!url) {
    return;
  }
  logger.debug('Redis repository cache init');
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
