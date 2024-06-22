import * as memCache from '../../../cache/memory';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheStrategy } from './abstract-cache-strategy';

/**
 * In-memory strategy meant to be used for private packages
 * and for testing purposes.
 */
export class GithubGraphqlMemoryCacheStrategy<
  GithubItem extends GithubDatasourceItem,
> extends AbstractGithubGraphqlCacheStrategy<GithubItem> {
  private fullKey(): string {
    return `github-graphql-cache:${this.cacheNs}:${this.cacheKey}`;
  }

  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    const key = this.fullKey();
    const res = memCache.get(key);
    return Promise.resolve(res);
  }

  persist(cacheRecord: GithubGraphqlCacheRecord<GithubItem>): Promise<void> {
    const key = this.fullKey();
    memCache.set(key, cacheRecord);
    return Promise.resolve();
  }
}
