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

  protected readonly now = DateTime.now();

  private readonly reconciledVersions = new Set<string>();

  /** Fields that will be persisted */
  private items: Record<string, GithubItem> | undefined;
  protected createdAt = this.now;
  protected updatedAt = this.now;

  constructor(
    protected readonly cacheNs: string,
    protected readonly cacheKey: string
  ) {}

  private async getItems(): Promise<Record<string, GithubItem>> {
    if (this.items) {
      return this.items;
    }

    let result: GithubGraphqlCacheRecord<GithubItem> = {
      items: {},
      createdAt: this.createdAt.toISO(),
      updatedAt: this.updatedAt.toISO(),
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
    this.updatedAt = DateTime.fromISO(result.updatedAt);
    this.items = result.items;
    return this.items;
  }

  private isStabilized(item: GithubItem): boolean {
    const { packageUnstableDays } = AbstractGithubGraphqlCacheAdapter;
    const unstableDuration = { days: packageUnstableDays };
    return isDateExpired(this.now, item.releaseTimestamp, unstableDuration);
  }

  async reconcile(items: GithubItem[]): Promise<boolean> {
    const cachedItems = await this.getItems();

    let isPaginationDone = false;
    for (const item of items) {
      const { version } = item;

      const oldItem = cachedItems[version];
      if (oldItem && this.isStabilized(oldItem)) {
        isPaginationDone = true;
      }

      cachedItems[version] = item;
      this.reconciledVersions.add(version);
    }

    this.items = cachedItems;
    return isPaginationDone;
  }

  private async store(cachedItems: Record<string, GithubItem>): Promise<void> {
    const cacheRecord: GithubGraphqlCacheRecord<GithubItem> = {
      items: cachedItems,
      createdAt: this.createdAt.toISO(),
      updatedAt: this.now.toISO(),
    };
    await this.persist(cacheRecord);
  }

  async finalize(): Promise<GithubItem[]> {
    const cachedItems = await this.getItems();
    const resultItems: Record<string, GithubItem> = {};

    for (const [version, item] of Object.entries(cachedItems)) {
      if (this.isStabilized(item) || this.reconciledVersions.has(version)) {
        resultItems[version] = item;
      }
    }

    await this.store(resultItems);
    return Object.values(resultItems);
  }

  abstract load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined>;
  abstract persist(_: GithubGraphqlCacheRecord<GithubItem>): Promise<void>;
}
