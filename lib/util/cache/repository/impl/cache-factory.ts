import type { RepositoryCacheType } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { RepoCache } from '../types';
import { RepoCacheLocal } from './local';
import { RepoCacheRedis } from './redis';
import { RepoCacheS3 } from './s3';

export class CacheFactory {
  static get(
    repository: string,
    repoFingerprint: string,
    cacheType: RepositoryCacheType,
  ): RepoCache {
    const type = cacheType.split('://')[0].trim().toLowerCase();
    if (type === 'local') {
      return new RepoCacheLocal(repository, repoFingerprint);
    } else if (type === 's3') {
      return new RepoCacheS3(repository, repoFingerprint, cacheType);
    } else if (type.includes('redis')) {
      return new RepoCacheRedis(repository, repoFingerprint, cacheType);
    } else {
      logger.warn(
        { cacheType },
        `Repository cache type not supported using type "local" instead`,
      );
      return new RepoCacheLocal(repository, repoFingerprint);
    }
  }
}
