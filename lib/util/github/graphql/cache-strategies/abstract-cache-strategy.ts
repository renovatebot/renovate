import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import type {
  GithubDatasourceItem,
  GithubGraphqlCacheRecord,
  GithubGraphqlCacheStrategy,
} from '../types';
import { isDateExpired } from '../util';

/**
 * Cache strategy handles the caching Github GraphQL items
 * and reconciling them with newly obtained ones from paginated queries.
 */
export abstract class AbstractGithubGraphqlCacheStrategy<
  GithubItem extends GithubDatasourceItem,
> implements GithubGraphqlCacheStrategy<GithubItem>
{
  /**
   * Time period after which a cache record is considered expired.
   */
  protected static readonly cacheTTLDays = 30;

  /**
   * The time which is used during single cache access cycle.
   */
  protected readonly now = DateTime.now().toUTC();

  /**
   * Set of all versions which were reconciled
   * during the current cache access cycle.
   */
  private readonly reconciledVersions = new Set<string>();

  /**
   * These fields will be persisted.
   */
  private items: Record<string, GithubItem> | undefined;
  protected createdAt = this.now;

  /**
   * This flag indicates whether there is any new or updated items
   */
  protected hasNovelty = false;

  /**
   * Loading and persisting data is delegated to the concrete strategy.
   */
  abstract load(): Promise<GithubGraphqlCacheRecord<GithubItem> | undefined>;
  abstract persist(
    cacheRecord: GithubGraphqlCacheRecord<GithubItem>,
  ): Promise<void>;

  constructor(
    protected readonly cacheNs: string,
    protected readonly cacheKey: string,
  ) {}

  /**
   * Load data previously persisted by this strategy
   * for given `cacheNs` and `cacheKey`.
   */
  private async getItems(): Promise<Record<string, GithubItem>> {
    if (this.items) {
      return this.items;
    }

    let result: GithubGraphqlCacheRecord<GithubItem> = {
      items: {},
      createdAt: this.createdAt.toISO()!,
    };

    const storedData = await this.load();
    if (storedData) {
      const cacheTTLDuration = {
        hours: AbstractGithubGraphqlCacheStrategy.cacheTTLDays * 24,
      };
      if (!isDateExpired(this.now, storedData.createdAt, cacheTTLDuration)) {
        result = storedData;
      }
    }

    this.createdAt = DateTime.fromISO(result.createdAt).toUTC();
    this.items = result.items;
    return this.items;
  }

  /**
   * If package release exists longer than this cache can exist,
   * we assume it won't updated/removed on the Github side.
   */
  private isStabilized(item: GithubItem): boolean {
    const unstableDuration = {
      hours: AbstractGithubGraphqlCacheStrategy.cacheTTLDays * 24,
    };
    return isDateExpired(this.now, item.releaseTimestamp, unstableDuration);
  }

  /**
   * Process items received from GraphQL page
   * ordered by `releaseTimestamp` in descending order
   * (fresh versions go first).
   */
  async reconcile(items: GithubItem[]): Promise<boolean> {
    const cachedItems = await this.getItems();

    let isPaginationDone = false;
    for (const item of items) {
      const { version } = item;
      const oldItem = cachedItems[version];

      // If we reached previously stored item that is stabilized,
      // we assume the further pagination will not yield any new items.
      //
      // However, we don't break the loop here, allowing to reconcile
      // the entire page of items. This protects us from unusual cases
      // when release authors intentionally break the timeline. Therefore,
      // while it feels appealing to break early, please don't do that.
      if (oldItem && this.isStabilized(oldItem)) {
        isPaginationDone = true;
      }

      // Check if item is new or updated
      if (!oldItem || !dequal(oldItem, item)) {
        this.hasNovelty = true;
      }

      cachedItems[version] = item;
      this.reconciledVersions.add(version);
    }

    this.items = cachedItems;
    return isPaginationDone;
  }

  /**
   * Handle removed items for packages that are not stabilized
   * and return the list of all items.
   */
  async finalize(): Promise<GithubItem[]> {
    const cachedItems = await this.getItems();
    const resultItems: Record<string, GithubItem> = {};

    let hasDeletedItems = false;
    for (const [version, item] of Object.entries(cachedItems)) {
      if (this.isStabilized(item) || this.reconciledVersions.has(version)) {
        resultItems[version] = item;
      } else {
        hasDeletedItems = true;
      }
    }

    if (this.hasNovelty || hasDeletedItems) {
      await this.store(resultItems);
    }

    return Object.values(resultItems);
  }

  private async store(cachedItems: Record<string, GithubItem>): Promise<void> {
    const cacheRecord: GithubGraphqlCacheRecord<GithubItem> = {
      items: cachedItems,
      createdAt: this.createdAt.toISO()!,
    };
    await this.persist(cacheRecord);
  }
}
