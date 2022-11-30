import * as packageCache from '../../../cache/package';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheAdapter } from './abstract-cache-adapter';

/**
 * Package cache adapter meant to be used for public packages.
 */
export class GithubGraphqlPackageCacheAdapter<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheAdapter<GithubItem> {
  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    return packageCache.get(this.cacheNs, this.cacheKey);
  }

  async persist(
    cacheRecord: GithubGraphqlCacheRecord<GithubItem>
  ): Promise<void> {
    const expiry = this.createdAt.plus({
      days: AbstractGithubGraphqlCacheAdapter.cacheTTLDays,
    });
    const { minutes: ttlMinutes } = expiry
      .diff(this.now, ['minutes'])
      .toObject();
    if (ttlMinutes && ttlMinutes > 0) {
      await packageCache.set(
        this.cacheNs,
        this.cacheKey,
        cacheRecord,
        ttlMinutes
      );
    }
  }
}
