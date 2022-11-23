import * as memCache from '../../../cache/memory';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheAdapter } from './abstract-cache-adapter';

export class GithubGraphqlMemoryCacheAdapter<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheAdapter<GithubItem> {
  private fullKey(): string {
    return `github-graphql-cache:${this.cacheNs}:${this.cacheKey}`;
  }

  load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    const res = memCache.get(this.fullKey());
    return Promise.resolve(res);
  }

  persist(record: GithubGraphqlCacheRecord<GithubItem>): Promise<void> {
    memCache.set(this.fullKey(), record);
    return Promise.resolve();
  }
}
