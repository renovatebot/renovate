import type { RepositoryCacheType } from '../../../../config/types';
import { logger } from '../../../../logger';
import { parseUrl } from '../../../url';
import type { RepoCache } from '../types';
import { LocalRepositoryCache } from './local';

export class CacheFactory {
  private static client: RepoCache | null;

  static get(
    repository: string,
    cacheType: RepositoryCacheType = 'local'
  ): RepoCache {
    const type = parseUrl(cacheType)?.protocol ?? 'local';

    switch (type) {
      case 'local':
        this.client = new LocalRepositoryCache(repository);
        break;
      default:
        this.client = new LocalRepositoryCache(repository);
        logger.warn(
          { parsedType: type, cacheType },
          `Repository cache type not supported using type "local" instead`
        );
        break;
    }

    return this.client;
  }
}
