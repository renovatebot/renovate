/**
 * Every `AbstractGithubDatasourceCache` implementation
 * should have `graphqlQuery` that uses parameters
 * defined this interface.
 */
export interface GithubQueryParams {
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

  /** Latest release timestamp (`releaseTimestamp`) of all releases. */
  lastReleasedAt?: string;
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
   * If package was released recently, we assume higher
   * probability of having one more release soon.
   *
   * In this case, we use `updateAfterMinutesFresh` option.
   */
  packageFreshDays?: number;

  /**
   * If package was released recently, we assume higher
   * probability of having one more release soon.
   *
   * In this case, this option will be used
   * instead of `updateAfterMinutes`.
   *
   * Fresh period is configured via `freshDays` option.
   */
  updateAfterMinutesFresh?: number;

  /**
   * How many days to wait until full cache reset (for single package).
   */
  resetAfterDays?: number;

  /**
   * Delays cache reset by some random amount of minutes,
   * in order to stabilize load during mass cache reset.
   */
  resetDeltaMinutes?: number;

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
