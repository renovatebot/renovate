import { DateTime, DurationLike } from 'luxon';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import type {
  GithubGraphqlResponse,
  GithubHttp,
} from '../../../util/http/github';
import type { GetReleasesConfig, Release } from '../types';
import { getApiBaseUrl } from './common';

export interface GithubQueryParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

interface QueryResponse<T extends FetchedItemBase> {
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

export interface FetchedItemBase {
  version: string;
}

export interface StoredItemBase extends FetchedItemBase {
  releaseTimestamp: string;
}

export interface GithubDatasourceCache<StoredItem extends StoredItemBase> {
  items: Record<string, StoredItem>;
  cacheCreatedAt: string;
  cacheUpdatedAt: string;
}

export interface GithubDatasourceCacheConfig<
  FetchedItem extends FetchedItemBase,
  StoredItem extends StoredItemBase
> {
  type: string;
  query: string;
  coerceFetched: (x: FetchedItem) => StoredItem;
  isEquivalent: (x: StoredItem, y: StoredItem) => boolean;
  coerceStored: (x: StoredItem) => Release;
  softResetMinutes?: number;
  hardResetDays?: number;
  stabilityPeriodDays?: number;
  maxPages?: number;
}

function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLike
): boolean {
  const then = DateTime.fromISO(date);
  return now >= then.plus(duration);
}

export abstract class AbstractGithubDatasourceCache<
  FetchedItem extends FetchedItemBase,
  StoredItem extends StoredItemBase
> {
  constructor(
    private http: GithubHttp,
    private softResetMinutes = 30,
    private hardResetDays = 7,
    private stabilityPeriodDays = 31,
    private perPage = 100,
    private maxPages = 10
  ) {}

  abstract readonly cacheNs: string;
  abstract readonly graphqlQuery: string;
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem;
  abstract isEquivalent(oldItem: StoredItem, newItem: StoredItem): boolean;
  abstract coerceStored(storedItem: StoredItem): Release;

  async getReleases(releasesConfig: GetReleasesConfig): Promise<Release[]> {
    const { packageName, registryUrl } = releasesConfig;

    const softReset: DurationLike = { minutes: this.softResetMinutes };
    const hardReset: DurationLike = { days: this.hardResetDays };
    const stabilityPeriod: DurationLike = { days: this.stabilityPeriodDays };

    const now = DateTime.now();
    let cache: GithubDatasourceCache<StoredItem> = {
      items: {},
      cacheCreatedAt: now.toISO(),
      cacheUpdatedAt: now.minus(softReset).toISO(),
    };

    const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/');
    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}/${name}`;
      const cachedRes = await packageCache.get<
        GithubDatasourceCache<StoredItem>
      >(this.cacheNs, cacheKey);

      let isCacheUpdated = false;

      if (cachedRes && !isExpired(now, cachedRes.cacheCreatedAt, hardReset)) {
        cache = cachedRes;
      } else {
        isCacheUpdated = true;
      }

      if (isExpired(now, cache.cacheUpdatedAt, softReset)) {
        const variables: GithubQueryParams = {
          owner,
          name,
          cursor: null,
          count: this.perPage,
        };

        const checkedItems = new Set<string>();

        try {
          let pagesAllowed = this.maxPages;
          let isIterating = true;
          while (pagesAllowed > 0 && isIterating) {
            const graphqlRes = await this.http.postJson<
              GithubGraphqlResponse<QueryResponse<FetchedItem>>
            >('/graphql', {
              baseUrl,
              body: { query: this.graphqlQuery, variables },
            });
            pagesAllowed -= 1;

            const data = graphqlRes.body.data;
            if (data) {
              const {
                nodes: fetchedItems,
                pageInfo: { hasNextPage, endCursor },
              } = data.repository.payload;

              if (hasNextPage) {
                variables.cursor = endCursor;
              } else {
                isIterating = false;
              }

              for (const item of fetchedItems) {
                const { version } = item;
                const oldStoredItem = cache.items[version];
                const storedItem = this.coerceFetched(item);

                checkedItems.add(version);

                const { releaseTimestamp } = storedItem;

                if (
                  !oldStoredItem ||
                  !this.isEquivalent(oldStoredItem, storedItem)
                ) {
                  cache.items[version] = storedItem;
                  isCacheUpdated = true;
                } else if (isExpired(now, releaseTimestamp, stabilityPeriod)) {
                  isIterating = false;
                  break;
                }
              }
            }
          }
        } catch (err) {
          logger.debug(
            { err },
            `GitHub datasource: error fetching cacheable GraphQL data`
          );
        }

        for (const [version, item] of Object.entries(cache.items)) {
          if (
            !isExpired(now, item.releaseTimestamp, stabilityPeriod) &&
            !checkedItems.has(version)
          ) {
            delete cache.items[version];
            isCacheUpdated = true;
          }
        }

        if (isCacheUpdated) {
          const expiry = DateTime.fromISO(cache.cacheCreatedAt).plus(hardReset);
          const { minutes: ttlMinutes } = expiry
            .diff(now, ['minutes'])
            .toObject();
          if (ttlMinutes && ttlMinutes > 0) {
            cache.cacheUpdatedAt = now.toISO();
            await packageCache.set(this.cacheNs, cacheKey, cache, ttlMinutes);
          }
        }
      }
    }

    const storedItems = Object.values(cache.items);
    return storedItems.map((item) => this.coerceStored(item));
  }
}
