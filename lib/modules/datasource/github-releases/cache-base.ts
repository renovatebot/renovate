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
  createdAt: string;
  updatedAt: string;
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

  abstract readonly cacheNs: string;
  abstract readonly graphqlQuery: string;
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;
  abstract isEquivalent(oldItem: StoredItem, newItem: StoredItem): boolean;

  async getItems(releasesConfig: GetReleasesConfig): Promise<StoredItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    const now = DateTime.now();

    let cacheItems: Record<string, StoredItem> = {};
    let cacheCreatedAt = now.toISO();
    let cacheUpdatedAt = now.minus(this.updateDuration).toISO();

    const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/');
    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}:${name}`;
      const cache = await packageCache.get<GithubDatasourceCache<StoredItem>>(
        this.cacheNs,
        cacheKey
      );

      const isUpdate =
        cache && !isExpired(now, cache.createdAt, this.resetDuration);
      if (isUpdate) {
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
            count: isUpdate
              ? this.itemsPerUpdatePage
              : this.itemsPerPrefetchPage,
          };

          const checkedItems = new Set<string>();

          let pagesAllowed = isUpdate
            ? this.maxUpdatePages
            : this.maxPrefetchPages;
          let stopIteration = false;
          while (pagesAllowed > 0 && !stopIteration) {
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
                stopIteration = true;
              }

              for (const item of fetchedItems) {
                const storedItem = this.coerceFetched(item);
                if (storedItem) {
                  const { version, releaseTimestamp } = storedItem;
                  cacheItems[version] = storedItem;
                  checkedItems.add(version);
                  stopIteration ||= isExpired(
                    now,
                    releaseTimestamp,
                    this.stabilityDuration
                  );
                }
              }
            }
          }

          for (const [version, item] of Object.entries(cacheItems)) {
            if (
              !isExpired(now, item.releaseTimestamp, this.stabilityDuration) &&
              !checkedItems.has(version)
            ) {
              delete cacheItems[version];
            }
          }

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
        if (isUpdate) {
          const cachedItems = Object.values(cache.items);
          return cachedItems;
        }
      }
    }

    const items = Object.values(cacheItems);
    return items;
  }
}
