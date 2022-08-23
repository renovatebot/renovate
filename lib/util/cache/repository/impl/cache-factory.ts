import type { RepositoryCacheType } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { RepoCache } from '../types';
import { RepoCacheLocal } from './local';

export class CacheFactory {
  static get(
    repository: string,
    repoFingerprint: string,
    cacheType: RepositoryCacheType
  ): RepoCache {
    switch (cacheType) {
      case 'local':
        return new RepoCacheLocal(repository, repoFingerprint);
      default:
        logger.warn(
          { cacheType },
          `Repository cache type not supported using type "local" instead`
        );
        return new RepoCacheLocal(repository, repoFingerprint);
    }
  }
}
