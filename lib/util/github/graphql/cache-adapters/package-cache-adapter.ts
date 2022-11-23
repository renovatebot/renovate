import * as packageCache from '../../../cache/package';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheAdapter } from './abstract-cache-adapter';

export class GithubGraphqlPackageCacheAdapter<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheAdapter<GithubItem> {
  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    return packageCache.get(this.cacheNs, this.cacheKey);
  }

  persist(record: GithubGraphqlCacheRecord<GithubItem>): Promise<void> {
    const ttlMinutes = this.cacheTTLDays * 24 * 60;
    return packageCache.set(this.cacheNs, this.cacheKey, record, ttlMinutes);
  }
}
