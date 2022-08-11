import { GlobalConfig } from '../../../../config/global';
import type { RepositoryCacheType } from '../../../../config/types';
import type { CacheClient } from '../types';
import { LocalRepoCache } from './local';

type CacheType = 'local' | 'redis' | 'S3';

export class CacheClientFactory {
  private static client: CacheClient;

  static get(repository: string, type: RepositoryCacheType): CacheClient {
    if (this.client) {
      return this.client;
    }

    const platform = GlobalConfig.get('platform');
    let cacheType: CacheType = 'local';
    if (type.startsWith('redis://')) {
      cacheType = 'redis';
    }
    if (type.startsWith('https://s3')) {
      cacheType = 'S3';
    }

    switch (cacheType) {
      case 'local':
        this.client = new LocalRepoCache(platform!, repository);
        break;
      case 'redis':
        break;
      case 'S3':
        break;
      default:
        break;
    }

    return this.client;
  }
}
