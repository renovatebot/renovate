import { GlobalConfig } from '../../../../../config/global';
import type { RepositoryCacheType } from '../../../../../config/types';
import { logger } from '../../../../../logger';
import type { CacheClient } from '../../types';
import { LocalRepoCache } from './local';

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
      // istanbul ignore next: untestable
      default:
        this.client = new LocalRepoCache(platform!, repository);
        logger.warn(
          { cacheType },
          `Repository cache type not supported using type "local" instead`
        );
        break;
    }

    return this.client;
  }

  static reset(): void {
    this.client = null;
  }
}
