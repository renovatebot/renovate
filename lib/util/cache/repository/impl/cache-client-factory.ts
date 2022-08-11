import { GlobalConfig } from '../../../../config/global';
import type { RepositoryCacheType } from '../../../../config/types';
import type { CacheClient } from '../types';
import { LocalRepoCache } from './local';

type CacheType = 'local' | 'redis' | 'S3';

export class CacheClientFactory {
  private static client: CacheClient | null;

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
      case 'S3':
      default:
        break;
    }

    return this.client!;
  }

  // TODO: remove once redis and s3 are implemented
  static reset(): void {
    this.client = null;
  }
}
