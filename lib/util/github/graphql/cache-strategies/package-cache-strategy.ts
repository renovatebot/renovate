import * as packageCache from '../../../cache/package';
import type { GithubDatasourceItem, GithubGraphqlCacheRecord } from '../types';
import { AbstractGithubGraphqlCacheStrategy } from './abstract-cache-strategy';

/**
 * `updateAt` should be stored at the separate cache key
 * to avoid frequent serialization of big cache records.
 */
type PackageCacheRecord<GithubItem extends GithubDatasourceItem> = Omit<
  GithubGraphqlCacheRecord<GithubItem>,
  'updatedAt'
> &
  // TODO: Remove `Partial` after 17 Apr 2023, once all cache records are migrated
  Partial<Pick<GithubGraphqlCacheRecord<GithubItem>, 'updatedAt'>>;

/**
 * Package cache strategy meant to be used for public packages.
 */
export class GithubGraphqlPackageCacheStrategy<
  GithubItem extends GithubDatasourceItem
> extends AbstractGithubGraphqlCacheStrategy<GithubItem> {
  async load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined> {
    const [data, upd] = await Promise.all([
      packageCache.get<PackageCacheRecord<GithubItem>>(
        this.cacheNs,
        this.cacheKey
      ),
      packageCache.get<string>(this.cacheNs, `${this.cacheKey}:updatedAt`),
    ]);
    const updatedAt = data?.updatedAt ? data.updatedAt : upd;

    if (!data || !updatedAt) {
      return undefined;
    }

    return {
      ...data,
      updatedAt,
    };
  }

  async persist(
    cacheRecord: GithubGraphqlCacheRecord<GithubItem>
  ): Promise<void> {
    const expiry = this.createdAt.plus({
      days: AbstractGithubGraphqlCacheStrategy.cacheTTLDays,
    });
    const ttlMinutes = expiry.diff(this.now, ['minutes']).as('minutes');

    if (ttlMinutes && ttlMinutes > 0) {
      if (this.hasUpdatedItems) {
        const packageCacheRecord: PackageCacheRecord<GithubItem> = {
          items: cacheRecord.items,
          createdAt: cacheRecord.createdAt,
        };
        await packageCache.set(
          this.cacheNs,
          this.cacheKey,
          packageCacheRecord,
          ttlMinutes
        );
      }

      await packageCache.set(
        this.cacheNs,
        `${this.cacheKey}:updatedAt`,
        cacheRecord.updatedAt,
        ttlMinutes
      );
    }
  }
}
