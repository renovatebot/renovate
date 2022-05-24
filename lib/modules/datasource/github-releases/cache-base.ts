import { DateTime, DurationLike } from 'luxon';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import type {
  GithubGraphqlResponse,
  GithubHttp,
} from '../../../util/http/github';
import type { GetReleasesConfig } from '../types';
import { getApiBaseUrl } from './common';

/**
 * Every `AbstractGithubDatasourceCache` implementation
 * should have `graphqlQuery` that uses parameters
 * defined this interface.
 */
interface GithubQueryParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

/**
 * Every `AbstractGithubDatasourceCache` implementation
 * should have `graphqlQuery` that resembles the structure
 * of this interface.
 */
export interface QueryResponse<T = unknown> {
  repository: {
    payload: {
      nodes: T[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}

/**
 * Base interface meant to be extended by all implementations.
 * Must have `version` and `releaseTimestamp` fields.
 */
export interface StoredItemBase {
  /** The values of `version` field meant to be unique. */
  version: string;

  /** The `releaseTimestamp` field meant to be ISO-encoded date. */
  releaseTimestamp: string;
}

/**
 * The data structure stored in the package cache.
 */
export interface GithubDatasourceCache<StoredItem extends StoredItemBase> {
  items: Record<string, StoredItem>;

  /** Cache full reset decision is based on `createdAt` value. */
  createdAt: string;

  /** Cache soft updates are performed depending on `updatedAt` value. */
  updatedAt: string;
}

/**
 * The configuration for cache.
 */
export interface CacheOptions {
  /**
   * How many minutes to wait until next cache update
   */
  updateAfterMinutes?: number;

  /**
   * How many days to wait until full cache reset (for single package).
   */
  resetAfterDays?: number;

  /**
   * How many days ago the package should be published to be considered as stable.
   * Since this period is expired, it won't be refreshed via soft updates anymore.
   */
  unstableDays?: number;

  /**
   * How many items per page to obtain per page during initial fetch (i.e. pre-fetch)
   */
  itemsPerPrefetchPage?: number;

  /**
   * How many pages to fetch (at most) during the initial fetch (i.e. pre-fetch)
   */
  maxPrefetchPages?: number;

  /**
   * How many items per page to obtain per page during the soft update
   */
  itemsPerUpdatePage?: number;

  /**
   * How many pages to fetch (at most) during the soft update
   */
  maxUpdatePages?: number;
}

/**
 * The options that are meant to be used in production.
 */
const cacheDefaults: Required<CacheOptions> = {
  /**
   * How many minutes to wait until next cache update
   */
  updateAfterMinutes: 30,

  /**
   * How many days to wait until full cache reset (for single package).
   */
  resetAfterDays: 7,

  /**
   * How many days ago the package should be published to be considered as stable.
   * Since this period is expired, it won't be refreshed via soft updates anymore.
   */
  unstableDays: 30,

  /**
   * How many items per page to obtain per page during initial fetch (i.e. pre-fetch)
   */
  itemsPerPrefetchPage: 100,

  /**
   * How many pages to fetch (at most) during the initial fetch (i.e. pre-fetch)
   */
  maxPrefetchPages: 10,

  /**
   * How many items per page to obtain per page during the soft update
   */
  itemsPerUpdatePage: 100,

  /**
   * How many pages to fetch (at most) during the soft update
   */
  maxUpdatePages: 10,
};

/**
 * Tells whether the time `duration` is expired starting
 * from the `date` (ISO date format) at the moment of `now`.
 */
function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLike
): boolean {
  const then = DateTime.fromISO(date);
  const expiry = then.plus(duration);
  return now >= expiry;
}

export abstract class AbstractGithubDatasourceCache<
  StoredItem extends StoredItemBase,
  FetchedItem = unknown
> {
  private updateDuration: DurationLike;
  private resetDuration: DurationLike;
  private stabilityDuration: DurationLike;

  private maxPrefetchPages: number;
  private itemsPerPrefetchPage: number;

  private maxUpdatePages: number;
  private itemsPerUpdatePage: number;

  constructor(private http: GithubHttp, opts: CacheOptions = {}) {
    const {
      updateAfterMinutes,
      resetAfterDays,
      unstableDays,
      maxPrefetchPages,
      itemsPerPrefetchPage,
      maxUpdatePages,
      itemsPerUpdatePage,
    } = {
      ...cacheDefaults,
      ...opts,
    };

    this.updateDuration = { minutes: updateAfterMinutes };
    this.resetDuration = { days: resetAfterDays };
    this.stabilityDuration = { days: unstableDays };

    this.maxPrefetchPages = maxPrefetchPages;
    this.itemsPerPrefetchPage = itemsPerPrefetchPage;
    this.maxUpdatePages = maxUpdatePages;
    this.itemsPerUpdatePage = itemsPerUpdatePage;
  }

  /**
   * The key at which data is stored in the package cache.
   */
  abstract readonly cacheNs: string;

  /**
   * The query string.
   * For parameters, see `GithubQueryParams`.
   */
  abstract readonly graphqlQuery: string;

  /**
   * Transform `fetchedItem` for storing in the package cache.
   * @param fetchedItem Node obtained from GraphQL response
   */
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;

  /**
   * Pre-fetch, update, or just return the package cache items.
   */
  async getItems(releasesConfig: GetReleasesConfig): Promise<StoredItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    // The time meant to be used across the function
    const now = DateTime.now();

    // Initialize items and timestamps for the new cache
    let cacheItems: Record<string, StoredItem> = {};
    let cacheCreatedAt = now.toISO();

    // We have to initialize `updatedAt` value as already expired,
    // so that soft update mechanics is immediately starting.
    let cacheUpdatedAt = now.minus(this.updateDuration).toISO();

    const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/'); // Replace for GHE

    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}:${name}`;
      const cache = await packageCache.get<GithubDatasourceCache<StoredItem>>(
        this.cacheNs,
        cacheKey
      );

      const cacheDoesExist =
        cache && !isExpired(now, cache.createdAt, this.resetDuration);
      if (cacheDoesExist) {
        // Keeping the the original `cache` value intact
        // in order to be used in exception handler
        cacheItems = { ...cache.items };
        cacheCreatedAt = cache.createdAt;
        cacheUpdatedAt = cache.updatedAt;
      }

      try {
        if (isExpired(now, cacheUpdatedAt, this.updateDuration)) {
          const variables: GithubQueryParams = {
            owner,
            name,
            cursor: null,
            count: cacheDoesExist
              ? this.itemsPerUpdatePage
              : this.itemsPerPrefetchPage,
          };

          // Collect version values to determine deleted items
          const checkedVersions = new Set<string>();

          // Page-by-page update loop
          let pagesRemained = cacheDoesExist
            ? this.maxUpdatePages
            : this.maxPrefetchPages;
          let stopIteration = false;
          while (pagesRemained > 0 && !stopIteration) {
            const graphqlRes = await this.http.postJson<
              GithubGraphqlResponse<QueryResponse<FetchedItem>>
            >('/graphql', {
              baseUrl,
              body: { query: this.graphqlQuery, variables },
            });
            pagesRemained -= 1;

            const data = graphqlRes.body.data;
            if (data) {
              const {
                nodes: fetchedItems,
                pageInfo: { hasNextPage, endCursor },
              } = data.repository.payload;

              if (hasNextPage) {
                variables.cursor = endCursor;
              } else {
                stopIteration = true;
              }

              for (const item of fetchedItems) {
                const newStoredItem = this.coerceFetched(item);
                if (newStoredItem) {
                  const { version } = newStoredItem;

                  // Stop earlier if the stored item have reached stability,
                  // which means `unstableDays` period have passed
                  const oldStoredItem = cacheItems[version];
                  if (
                    oldStoredItem &&
                    isExpired(
                      now,
                      oldStoredItem.releaseTimestamp,
                      this.stabilityDuration
                    )
                  ) {
                    stopIteration = true;
                    break;
                  }

                  cacheItems[version] = newStoredItem;
                  checkedVersions.add(version);
                }
              }
            }
          }

          // Detect removed items
          for (const [version, item] of Object.entries(cacheItems)) {
            if (
              !isExpired(now, item.releaseTimestamp, this.stabilityDuration) &&
              !checkedVersions.has(version)
            ) {
              delete cacheItems[version];
            }
          }

          // Store cache
          const expiry = DateTime.fromISO(cacheCreatedAt).plus(
            this.resetDuration
          );
          const { minutes: ttlMinutes } = expiry
            .diff(now, ['minutes'])
            .toObject();
          if (ttlMinutes && ttlMinutes > 0) {
            const cacheValue: GithubDatasourceCache<StoredItem> = {
              items: cacheItems,
              createdAt: cacheCreatedAt,
              updatedAt: now.toISO(),
            };
            await packageCache.set(
              this.cacheNs,
              cacheKey,
              cacheValue,
              ttlMinutes
            );
          }
        }
      } catch (err) {
        logger.debug(
          { err },
          `GitHub datasource: error fetching cacheable GraphQL data`
        );

        // On errors, return previous value (if valid)
        if (cacheDoesExist) {
          const cachedItems = Object.values(cache.items);
          return cachedItems;
        }
      }
    }

    const items = Object.values(cacheItems);
    return items;
  }
}
