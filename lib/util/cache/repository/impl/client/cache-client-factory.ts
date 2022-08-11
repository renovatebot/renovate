import { GlobalConfig } from '../../../../../config/global';
import type { RepositoryCacheType } from '../../../../../config/types';
import { logger } from '../../../../../logger';
import type { CacheClient } from '../../types';
import { LocalRepoCache } from './local/local';

export class CacheClientFactory {
  private static client: CacheClient | null;

  static get(repository: string, cacheType: RepositoryCacheType): CacheClient {
    if (this.client) {
      return this.client;
    }

    const platform = GlobalConfig.get('platform');

    switch (cacheType) {
      case 'local':
        this.client = new LocalRepoCache(platform!, repository);
        break;
      case 'redis':
      case 's3':
      default:
        this.client = new LocalRepoCache(platform!, repository);
        logger.info(
          `Repository cache type: ${cacheType} not supported using type "local" instead`
        );
        break;
    }

    return this.client;
  }

  // TODO: remove once redis and s3 are implemented
  static reset(): void {
    this.client = null;
  }
}
