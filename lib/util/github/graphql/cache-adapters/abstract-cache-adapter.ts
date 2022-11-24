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
  protected static readonly packageUnstableDays = 7;
  protected static readonly cacheTTLDays = 30;

  public readonly now = DateTime.now();

  private createdAt = this.now;
  private refreshedAt = this.createdAt;
  private cachedItems: Record<string, GithubItem> | undefined;

  private readonly reconciledVersions = new Set<string>();

  constructor(
    protected readonly cacheNs: string,
    protected readonly cacheKey: string
  ) {}

  private async getCachedItems(): Promise<Record<string, GithubItem>> {
    if (this.cachedItems) {
      return this.cachedItems;
    }

    let result: GithubGraphqlCacheRecord<GithubItem> = {
      items: {},
      createdAt: this.createdAt.toISO(),
      refreshedAt: this.refreshedAt.toISO(),
    };

    const storedData = await this.load();
    if (storedData) {
      const { cacheTTLDays } = AbstractGithubGraphqlCacheAdapter;
      const cacheTTLDuration = { days: cacheTTLDays };
      if (!isDateExpired(this.now, storedData.createdAt, cacheTTLDuration)) {
        result = storedData;
      }
    }

    this.createdAt = DateTime.fromISO(result.createdAt);
    this.refreshedAt = DateTime.fromISO(result.refreshedAt);
    this.cachedItems = result.items;
    return this.cachedItems;
  }

  private isPackageStabilized(item: GithubItem): boolean {
    const { packageUnstableDays } = AbstractGithubGraphqlCacheAdapter;
    const unstableDuration = { days: packageUnstableDays };
    return isDateExpired(this.now, item.releaseTimestamp, unstableDuration);
  }

  async reconcile(items: GithubItem[]): Promise<boolean> {
    const cachedItems = await this.getCachedItems();

    let done = false;
    for (const item of items) {
      const { version } = item;

      const oldItem = cachedItems[version];
      if (oldItem && this.isPackageStabilized(oldItem)) {
        done = true;
      }

      cachedItems[version] = item;
      this.reconciledVersions.add(version);
    }

    this.cachedItems = cachedItems;
    return done;
  }

  private async store(cachedItems: Record<string, GithubItem>): Promise<void> {
    const expiry = this.createdAt.plus(
      AbstractGithubGraphqlCacheAdapter.cacheTTLDays
    );
    const { minutes: ttlMinutes } = expiry
      .diff(this.now, ['minutes'])
      .toObject();
    if (ttlMinutes && ttlMinutes > 0) {
      const cacheRecord: GithubGraphqlCacheRecord<GithubItem> = {
        items: cachedItems,
        createdAt: this.createdAt.toISO(),
        refreshedAt: this.now.toISO(),
      };

      await this.persist(cacheRecord);
    }
  }

  async finalize(): Promise<GithubItem[]> {
    const cachedItems = await this.getCachedItems();
    const resultItems: Record<string, GithubItem> = {};
    for (const [version, item] of Object.entries(cachedItems)) {
      if (
        this.isPackageStabilized(item) ||
        this.reconciledVersions.has(version)
      ) {
        resultItems[version] = item;
      }
    }

    await this.store(resultItems);
    return Object.values(resultItems);
  }

  abstract load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined>;
  abstract persist(_: GithubGraphqlCacheRecord<GithubItem>): Promise<void>;
}
