import * as memCache from '../../../cache/memory';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheAdapter } from './abstract-cache-adapter';

/**
 * In-memory adapter meant to be used for private packages
 * and for testing purposes.
 */
export class GithubGraphqlMemoryCacheAdapter<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheAdapter<GithubItem> {
  private fullKey(): string {
    return `github-graphql-cache:${this.cacheNs}:${this.cacheKey}`;
  }

  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    const key = this.fullKey();
    const res = memCache.get(key);
    return Promise.resolve(res);
  }

  persist(record: GithubGraphqlCacheRecord<GithubItem>): Promise<void> {
    const expiry = this.createdAt.plus({
      days: AbstractGithubGraphqlCacheAdapter.cacheTTLDays,
    });
    const { seconds: ttlSeconds } = expiry
      .diff(this.now, ['seconds'])
      .toObject();
    if (ttlSeconds && ttlSeconds > 0) {
      const key = this.fullKey();
      memCache.set(key, record);
    }
    return Promise.resolve();
  }
}
