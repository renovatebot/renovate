import { DateTime, DurationLike } from 'luxon';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import type {
  GithubGraphqlResponse,
  GithubHttp,
} from '../../../util/http/github';
import type { GetReleasesConfig } from '../types';
import { getApiBaseUrl } from './common';

export interface GithubQueryParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

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

export interface StoredItemBase {
  version: string;
  releaseTimestamp: string;
}

export interface GithubDatasourceCache<StoredItem extends StoredItemBase> {
  items: Record<string, StoredItem>;
  cacheCreatedAt: string;
  cacheUpdatedAt: string;
}

export interface CacheOptions {
  updateAfterMinutes?: number;
  resetAfterDays?: number;
  unstableDays?: number;

  itemsPerPrefetchPage?: number;
  maxPrefetchPages?: number;

  itemsPerUpdatePage?: number;
  maxUpdatePages?: number;
}

const cacheDefaults: Required<CacheOptions> = {
  updateAfterMinutes: 30,
  resetAfterDays: 7,
  unstableDays: 30,

  itemsPerPrefetchPage: 100,
  maxPrefetchPages: 10,

  itemsPerUpdatePage: 100,
  maxUpdatePages: 10,
};

function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLike
): boolean {
  const then = DateTime.fromISO(date);
  return now >= then.plus(duration);
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

  abstract readonly cacheNs: string;
  abstract readonly graphqlQuery: string;
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;
  abstract isEquivalent(oldItem: StoredItem, newItem: StoredItem): boolean;

  async getItems(releasesConfig: GetReleasesConfig): Promise<StoredItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    const now = DateTime.now();
    let cache: GithubDatasourceCache<StoredItem> = {
      items: {},
      cacheCreatedAt: now.toISO(),
      cacheUpdatedAt: now.minus(this.updateDuration).toISO(),
    };

    const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/');
    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}/${name}`;
      const cachedRes = await packageCache.get<
        GithubDatasourceCache<StoredItem>
      >(this.cacheNs, cacheKey);

      let isUpdate = false;
      if (
        cachedRes &&
        !isExpired(now, cachedRes.cacheCreatedAt, this.resetDuration)
      ) {
        cache = cachedRes;
        isUpdate = true;
      }

      try {
        if (isExpired(now, cache.cacheUpdatedAt, this.updateDuration)) {
          const variables: GithubQueryParams = {
            owner,
            name,
            cursor: null,
            count: isUpdate
              ? this.itemsPerUpdatePage
              : this.itemsPerPrefetchPage,
          };

          const checkedItems = new Set<string>();

          let pagesAllowed = isUpdate
            ? this.maxUpdatePages
            : this.maxPrefetchPages;
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
                const newStoredItem = this.coerceFetched(item);
                if (newStoredItem) {
                  const { version, releaseTimestamp } = newStoredItem;
                  checkedItems.add(version);

                  const oldStoredItem = cache.items[version];
                  if (
                    !oldStoredItem ||
                    !this.isEquivalent(oldStoredItem, newStoredItem)
                  ) {
                    cache.items[version] = newStoredItem;
                  } else if (
                    isExpired(now, releaseTimestamp, this.stabilityDuration)
                  ) {
                    isIterating = false;
                    break;
                  }
                }
              }
            }
          }

          for (const [version, item] of Object.entries(cache.items)) {
            if (
              !isExpired(now, item.releaseTimestamp, this.stabilityDuration) &&
              !checkedItems.has(version)
            ) {
              delete cache.items[version];
            }
          }

          const expiry = DateTime.fromISO(cache.cacheCreatedAt).plus(
            this.resetDuration
          );
          const { minutes: ttlMinutes } = expiry
            .diff(now, ['minutes'])
            .toObject();
          if (ttlMinutes && ttlMinutes > 0) {
            cache.cacheUpdatedAt = now.toISO();
            await packageCache.set(this.cacheNs, cacheKey, cache, ttlMinutes);
          }
        }
      } catch (err) {
        logger.debug(
          { err },
          `GitHub datasource: error fetching cacheable GraphQL data`
        );
      }
    }

    const storedItems = Object.values(cache.items);
    return storedItems;
  }
}
