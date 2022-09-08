import is from '@sindresorhus/is';
import { DateTime, DurationLikeObject } from 'luxon';
import { logger } from '../../../../logger';
import * as memCache from '../../../../util/cache/memory';
import * as packageCache from '../../../../util/cache/package';
import type {
  CacheOptions,
  ChangelogRelease,
  GithubCachedItem,
  GithubDatasourceCache,
  GithubGraphqlRepoParams,
  GithubGraphqlRepoResponse,
} from '../../../../util/github/types';
import { getApiBaseUrl } from '../../../../util/github/url';
import type {
  GithubGraphqlResponse,
  GithubHttp,
  GithubHttpOptions,
} from '../../../../util/http/github';
import type { GetReleasesConfig } from '../../types';

/**
 * The options that are meant to be used in production.
 */
const cacheDefaults: Required<CacheOptions> = {
  /**
   * How many minutes to wait until next cache update
   */
  updateAfterMinutes: 120,

  /**
   * If package was released recently, we assume higher
   * probability of having one more release soon.
   *
   * In this case, we use `updateAfterMinutesFresh` option.
   */
  packageFreshDays: 7,

  /**
   * If package was released recently, we assume higher
   * probability of having one more release soon.
   *
   * In this case, this option will be used
   * instead of `updateAfterMinutes`.
   *
   * Fresh period is configured via `freshDays` option.
   */
  updateAfterMinutesFresh: 30,

  /**
   * How many days to wait until full cache reset (for single package).
   */
  resetAfterDays: 7,

  /**
   * Delays cache reset by some random amount of minutes,
   * in order to stabilize load during mass cache reset.
   */
  resetDeltaMinutes: 3 * 60,

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
  maxPrefetchPages: 100,

  /**
   * How many items per page to obtain per page during the soft update
   */
  itemsPerUpdatePage: 100,

  /**
   * How many pages to fetch (at most) during the soft update
   */
  maxUpdatePages: 100,
};

/**
 * Tells whether the time `duration` is expired starting
 * from the `date` (ISO date format) at the moment of `now`.
 */
function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLikeObject
): boolean {
  const then = DateTime.fromISO(date);
  const expiry = then.plus(duration);
  return now >= expiry;
}

export abstract class AbstractGithubDatasourceCache<
  CachedItem extends GithubCachedItem,
  FetchedItem = unknown
> {
  private updateDuration: DurationLikeObject;
  private packageFreshDaysDuration: DurationLikeObject;
  private updateDurationFresh: DurationLikeObject;
  private resetDuration: DurationLikeObject;
  private stabilityDuration: DurationLikeObject;

  private maxPrefetchPages: number;
  private itemsPerPrefetchPage: number;

  private maxUpdatePages: number;
  private itemsPerUpdatePage: number;

  private resetDeltaMinutes: number;

  constructor(private http: GithubHttp, opts: CacheOptions = {}) {
    const {
      updateAfterMinutes,
      packageFreshDays,
      updateAfterMinutesFresh,
      resetAfterDays,
      unstableDays,
      maxPrefetchPages,
      itemsPerPrefetchPage,
      maxUpdatePages,
      itemsPerUpdatePage,
      resetDeltaMinutes,
    } = {
      ...cacheDefaults,
      ...opts,
    };

    this.updateDuration = { minutes: updateAfterMinutes };
    this.packageFreshDaysDuration = { days: packageFreshDays };
    this.updateDurationFresh = { minutes: updateAfterMinutesFresh };
    this.resetDuration = { days: resetAfterDays };
    this.stabilityDuration = { days: unstableDays };

    this.maxPrefetchPages = maxPrefetchPages;
    this.itemsPerPrefetchPage = itemsPerPrefetchPage;
    this.maxUpdatePages = maxUpdatePages;
    this.itemsPerUpdatePage = itemsPerUpdatePage;

    this.resetDeltaMinutes = resetDeltaMinutes;
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
  abstract coerceFetched(fetchedItem: FetchedItem): CachedItem | null;

  private async queryPayload(
    baseUrl: string,
    variables: GithubGraphqlRepoParams,
    options: GithubHttpOptions
  ): Promise<
    GithubGraphqlRepoResponse<FetchedItem>['repository']['payload'] | Error
  > {
    try {
      const graphqlRes = await this.http.postJson<
        GithubGraphqlResponse<GithubGraphqlRepoResponse<FetchedItem>>
      >('/graphql', {
        ...options,
        baseUrl,
        body: { query: this.graphqlQuery, variables },
      });
      const { body } = graphqlRes;
      const { data, errors } = body;

      if (errors) {
        let [errorMessage] = errors
          .map(({ message }) => message)
          .filter(is.string);
        errorMessage ??= 'GitHub datasource cache: unknown GraphQL error';
        return new Error(errorMessage);
      }

      if (!data?.repository?.payload) {
        return new Error(
          'GitHub datasource cache: failed to obtain payload data'
        );
      }

      return data.repository.payload;
    } catch (err) {
      return err;
    }
  }

  private getBaseUrl(registryUrl: string | undefined): string {
    const baseUrl = getApiBaseUrl(registryUrl).replace(/\/v3\/$/, '/'); // Replace for GHE
    return baseUrl;
  }

  private getCacheKey(
    registryUrl: string | undefined,
    packageName: string
  ): string {
    const baseUrl = this.getBaseUrl(registryUrl);
    const [owner, name] = packageName.split('/');
    const cacheKey = `${baseUrl}:${owner}:${name}`;
    return cacheKey;
  }

  /**
   * Pre-fetch, update, or just return the package cache items.
   */
  async getItemsImpl(
    releasesConfig: GetReleasesConfig,
    changelogRelease?: ChangelogRelease
  ): Promise<CachedItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    // The time meant to be used across the function
    const now = DateTime.now();

    // Initialize items and timestamps for the new cache
    let cacheItems: Record<string, CachedItem> = {};

    // Add random minutes to the creation date in order to
    // provide back-off time during mass cache invalidation.
    const randomDelta = this.getRandomDeltaMinutes();
    let cacheCreatedAt = now.plus(randomDelta).toISO();

    // We have to initialize `updatedAt` value as already expired,
    // so that soft update mechanics is immediately starting.
    let cacheUpdatedAt = now.minus(this.updateDuration).toISO();

    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const baseUrl = this.getBaseUrl(registryUrl);
      const cacheKey = this.getCacheKey(registryUrl, packageName);
      const cache = await packageCache.get<GithubDatasourceCache<CachedItem>>(
        this.cacheNs,
        cacheKey
      );

      const cacheDoesExist =
        cache && !isExpired(now, cache.createdAt, this.resetDuration);
      let lastReleasedAt: string | null = null;
      let updateDuration = this.updateDuration;
      if (cacheDoesExist) {
        // Keeping the the original `cache` value intact
        // in order to be used in exception handler
        cacheItems = { ...cache.items };
        cacheCreatedAt = cache.createdAt;
        cacheUpdatedAt = cache.updatedAt;
        lastReleasedAt =
          cache.lastReleasedAt ?? this.getLastReleaseTimestamp(cacheItems);

        // Release is considered fresh, so we'll check it earlier
        if (
          lastReleasedAt &&
          !isExpired(now, lastReleasedAt, this.packageFreshDaysDuration)
        ) {
          updateDuration = this.updateDurationFresh;
        }
      }

      if (
        isExpired(now, cacheUpdatedAt, updateDuration) ||
        this.newChangelogReleaseDetected(
          changelogRelease,
          now,
          updateDuration,
          cacheItems
        )
      ) {
        const variables: GithubGraphqlRepoParams = {
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
          const queryResult = await this.queryPayload(baseUrl, variables, {
            repository: packageName,
          });
          if (queryResult instanceof Error) {
            if (
              queryResult.message.startsWith(
                'Something went wrong while executing your query.' // #16343
              ) &&
              variables.count > 30
            ) {
              logger.warn(
                `GitHub datasource cache: shrinking GraphQL page size due to error`
              );
              pagesRemained *= 2;
              variables.count = Math.floor(variables.count / 2);
              continue;
            }
            throw queryResult;
          }

          pagesRemained -= 1;

          const {
            nodes: fetchedItems,
            pageInfo: { hasNextPage, endCursor },
          } = queryResult;

          if (hasNextPage) {
            variables.cursor = endCursor;
          } else {
            stopIteration = true;
          }

          for (const item of fetchedItems) {
            const newStoredItem = this.coerceFetched(item);
            if (newStoredItem) {
              const { version, releaseTimestamp } = newStoredItem;

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
              }

              cacheItems[version] = newStoredItem;
              checkedVersions.add(version);

              lastReleasedAt ??= releaseTimestamp;
              // It may be tempting to optimize the code and
              // remove the check, as we're fetching fresh releases here.
              // That's wrong, because some items are already cached,
              // and they obviously aren't latest.
              if (
                DateTime.fromISO(releaseTimestamp) >
                DateTime.fromISO(lastReleasedAt)
              ) {
                lastReleasedAt = releaseTimestamp;
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
          const cacheValue: GithubDatasourceCache<CachedItem> = {
            items: cacheItems,
            createdAt: cacheCreatedAt,
            updatedAt: now.toISO(),
          };

          if (lastReleasedAt) {
            cacheValue.lastReleasedAt = lastReleasedAt;
          }

          await packageCache.set(
            this.cacheNs,
            cacheKey,
            cacheValue,
            ttlMinutes
          );
        }
      }
    }

    const items = Object.values(cacheItems);
    return items;
  }

  getItems(
    releasesConfig: GetReleasesConfig,
    changelogRelease?: ChangelogRelease
  ): Promise<CachedItem[]> {
    const { packageName, registryUrl } = releasesConfig;
    const cacheKey = this.getCacheKey(registryUrl, packageName);
    const promiseKey = `github-datasource-cache:${this.cacheNs}:${cacheKey}`;
    const res =
      memCache.get<Promise<CachedItem[]>>(promiseKey) ??
      this.getItemsImpl(releasesConfig, changelogRelease);
    memCache.set(promiseKey, res);
    return res;
  }

  getRandomDeltaMinutes(): number {
    const rnd = Math.random();
    return Math.floor(rnd * this.resetDeltaMinutes);
  }

  public getLastReleaseTimestamp(
    items: Record<string, CachedItem>
  ): string | null {
    let result: string | null = null;
    let latest: DateTime | null = null;

    for (const { releaseTimestamp } of Object.values(items)) {
      const timestamp = DateTime.fromISO(releaseTimestamp);

      result ??= releaseTimestamp;
      latest ??= timestamp;

      if (timestamp > latest) {
        result = releaseTimestamp;
        latest = timestamp;
      }
    }

    return result;
  }

  newChangelogReleaseDetected(
    changelogRelease: ChangelogRelease | undefined,
    now: DateTime,
    updateDuration: DurationLikeObject,
    cacheItems: Record<string, CachedItem>
  ): boolean {
    if (!changelogRelease?.date) {
      return false;
    }

    const releaseTime = changelogRelease.date.toString();
    const isVersionPresentInCache = !!cacheItems[changelogRelease.version];
    const isChangelogReleaseFresh = !isExpired(
      now,
      releaseTime,
      updateDuration
    );

    if (isVersionPresentInCache || !isChangelogReleaseFresh) {
      return false;
    }

    return true;
  }
}
