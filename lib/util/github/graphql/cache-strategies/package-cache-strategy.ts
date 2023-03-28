import * as packageCache from '../../../cache/package';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheStrategy } from './abstract-cache-strategy';

/**
 * Package cache strategy meant to be used for public packages.
 */
export class GithubGraphqlPackageCacheStrategy<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheStrategy<GithubItem> {
  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    return packageCache.get(this.cacheNs, this.cacheKey);
  }

  async persist(
    cacheRecord: GithubGraphqlCacheRecord<GithubItem>
  ): Promise<void> {
    if (this.hasUpdatedItems) {
      const expiry = this.createdAt.plus({
        days: AbstractGithubGraphqlCacheStrategy.cacheTTLDays,
      });
      const ttlMinutes = expiry.diff(this.now, ['minutes']).as('minutes');
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
}
