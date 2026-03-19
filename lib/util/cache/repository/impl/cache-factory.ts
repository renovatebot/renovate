import type { RepositoryCacheType } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { RepoCache } from '../types.ts';
import { RepoCacheLocal } from './local.ts';
import { RepoCacheS3 } from './s3.ts';

export class CacheFactory {
  static get(
    repository: string,
    repoFingerprint: string,
    cacheType: RepositoryCacheType,
  ): RepoCache {
    const type = cacheType.split('://')[0].trim().toLowerCase();
    switch (type) {
      case 'local':
        return new RepoCacheLocal(repository, repoFingerprint);
      case 's3':
        return new RepoCacheS3(repository, repoFingerprint, cacheType);
      default:
        logger.warn(
          { cacheType },
          `Repository cache type not supported using type "local" instead`,
        );
        return new RepoCacheLocal(repository, repoFingerprint);
    }
  }
}
