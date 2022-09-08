/**
 * REST responses
 */
export interface GithubRestRelease {
  id: number;
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  draft?: boolean;
  assets: GithubRestAsset[];

  html_url: string;
  name: string;
  body: string;
}

export interface GithubRestAsset {
  name: string;
  url: string;
  browser_download_url: string;
  size: number;
}

export interface GithubRestRef {
  object: {
    type: string;
    url: string;
    sha: string;
  };
}

export interface GithubRestTag {
  name: string;
}

/**
 * Release asset
 */
export interface GithubDigestFile {
  assetName: string;
  currentVersion: string;
  currentDigest: string;
  digestedFileName?: string;
}

/**
 * Parameters used for GraphQL queries with pagination
 */
export interface GithubGraphqlRepoParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

/**
 * Common shape for GraphQL responses for repository items
 */
export interface GithubGraphqlRepoResponse<T = unknown> {
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
 * GraphQL shape for releases
 */
export interface GithubGraphqlRelease {
  version: string;
  releaseTimestamp: string;
  isDraft: boolean;
  isPrerelease: boolean;
  url: string;
  id: number;
  name: string;
  description: string;
}

/**
 * GraphQL shape for tags
 */
export interface GithubGraphqlTag {
  version: string;
  target:
    | {
        type: 'Commit';
        hash: string;
        releaseTimestamp: string;
      }
    | {
        type: 'Tag';
        target: {
          hash: string;
        };
        tagger: {
          releaseTimestamp: string;
        };
      };
}

/**
 * The structures being stored with long-term caching
 */
export interface GithubCachedItem {
  version: string;
  releaseTimestamp: string;
}

export interface GithubCachedRelease extends GithubCachedItem {
  isStable?: boolean;
  url: string;
  id: number;
  name: string;
  description: string;
}

export interface GithubCachedTag extends GithubCachedItem {
  hash: string;
  releaseTimestamp: string;
}

/**
 * The common structure of datasource cache
 */
export interface GithubDatasourceCache<CachedItem extends GithubCachedItem> {
  items: Record<string, CachedItem>;

  /** Used for determining hard reset time */
  createdAt: string;

  /** Used for determining soft reset time */
  updatedAt: string;

  /** The most fresh `releaseTimestamp` of all items */
  lastReleasedAt?: string;
}

/**
 * The configuration for datasource cache
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

/**
 * This type is used to handle the following edge-case:
 *
 *   1. Package is being released on both NPM and GitHub
 *   2. Renovate know there is new release in NPM
 *   3. Renovate didn't update it's cache for GitHub datasource
 *   4. We can't obtain release notes from GitHub because of this
 *
 * By providing this additional structure, we can soft reset cache
 * once we know it's released for NPM or any other package manager.
 */
export interface ChangelogRelease {
  date: string | Date;
  version: string;
}
