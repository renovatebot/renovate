import { DateTime, DurationLikeObject } from 'luxon';
import { logger } from '../../../../logger';
import * as packageCache from '../../../../util/cache/package';
import type {
  GithubGraphqlResponse,
  GithubHttp,
  GithubHttpOptions,
} from '../../../../util/http/github';
import type { GetReleasesConfig } from '../../types';
import { getApiBaseUrl } from '../common';
import type {
  CacheOptions,
  ChangelogRelease,
  GithubDatasourceCache,
  GithubQueryParams,
  QueryResponse,
  StoredItemBase,
} from './types';

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
  StoredItem extends StoredItemBase,
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
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;

  private async query(
    baseUrl: string,
    variables: GithubQueryParams,
    options: GithubHttpOptions
  ): Promise<QueryResponse<FetchedItem> | Error> {
    try {
      const graphqlRes = await this.http.postJson<
        GithubGraphqlResponse<QueryResponse<FetchedItem>>
      >('/graphql', {
        ...options,
        baseUrl,
        body: { query: this.graphqlQuery, variables },
      });
      const { body } = graphqlRes;
      const { data, errors } = body;
      return data ?? new Error(errors?.[0]?.message);
    } catch (err) {
      return err;
    }
  }

  /**
   * Pre-fetch, update, or just return the package cache items.
   */
  async getItems(
    releasesConfig: GetReleasesConfig,
    changelogRelease?: ChangelogRelease
  ): Promise<StoredItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    // The time meant to be used across the function
    const now = DateTime.now();

    // Initialize items and timestamps for the new cache
    let cacheItems: Record<string, StoredItem> = {};

    // Add random minutes to the creation date in order to
    // provide back-off time during mass cache invalidation.
    const randomDelta = this.getRandomDeltaMinutes();
    let cacheCreatedAt = now.plus(randomDelta).toISO();

    // We have to initialize `updatedAt` value as already expired,
    // so that soft update mechanics is immediately starting.
    let cacheUpdatedAt = now.minus(this.updateDuration).toISO();

    const baseUrl = getApiBaseUrl(registryUrl).replace(/\/v3\/$/, '/'); // Replace for GHE

    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}:${name}`;
      const cache = await packageCache.get<GithubDatasourceCache<StoredItem>>(
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
          const res = await this.query(baseUrl, variables, {
            repository: packageName,
          });
          if (res instanceof Error) {
            if (
              res.message.startsWith(
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
            throw res;
          }

          pagesRemained -= 1;

          const {
            nodes: fetchedItems,
            pageInfo: { hasNextPage, endCursor },
          } = res.repository.payload;

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
          const cacheValue: GithubDatasourceCache<StoredItem> = {
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

  getRandomDeltaMinutes(): number {
    const rnd = Math.random();
    return Math.floor(rnd * this.resetDeltaMinutes);
  }

  public getLastReleaseTimestamp(
    items: Record<string, StoredItem>
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
    cacheItems: Record<string, StoredItem>
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
