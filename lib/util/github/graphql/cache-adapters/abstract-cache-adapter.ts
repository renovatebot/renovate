import { DateTime } from 'luxon';
import type {
  GithubDatasourceItem,
  GithubGraphqlCacheAdapter,
  GithubGraphqlCacheRecord,
} from '../types';
import { isDateExpired } from '../util';

export abstract class AbstractGithubGraphqlCacheAdapter<
  GithubItem extends GithubDatasourceItem
> implements GithubGraphqlCacheAdapter<GithubItem>
{
  protected readonly cacheTTLDays = 30;

  public readonly accessedAt = DateTime.now();
  private createdAt = this.accessedAt;
  private refreshedAt = this.createdAt;
  private items: Record<string, GithubItem> | undefined;

  constructor(
    protected readonly cacheNs: string,
    protected readonly cacheKey: string
  ) {}

  async get(): Promise<Record<string, GithubItem>> {
    if (this.items) {
      return this.items;
    }

    let result: GithubGraphqlCacheRecord<GithubItem> = {
      items: {},
      createdAt: this.createdAt.toISO(),
      refreshedAt: this.refreshedAt.toISO(),
    };

    const storedData = await this.load();
    if (
      storedData &&
      !isDateExpired(this.accessedAt, storedData.createdAt, {
        days: this.cacheTTLDays,
      })
    ) {
      result = storedData;
    }

    this.createdAt = DateTime.fromISO(result.createdAt);
    this.refreshedAt = DateTime.fromISO(result.refreshedAt);
    this.items = result.items;
    return this.items;
  }

  async set(items: Record<string, GithubItem>): Promise<void> {
    const expiry = this.createdAt.plus({ days: this.cacheTTLDays });
    const { minutes: ttlMinutes } = expiry
      .diff(this.accessedAt, ['minutes'])
      .toObject();
    if (ttlMinutes && ttlMinutes > 0) {
      const cacheRecord: GithubGraphqlCacheRecord<GithubItem> = {
        items,
        createdAt: this.createdAt.toISO(),
        refreshedAt: this.accessedAt.toISO(),
      };

      await this.persist(cacheRecord);
    }
  }

  abstract load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined>;
  abstract persist(_: GithubGraphqlCacheRecord<GithubItem>): Promise<void>;
}
