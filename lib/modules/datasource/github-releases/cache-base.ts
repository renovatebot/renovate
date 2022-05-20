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
    private updateAfterMinutes = 30,
    private resetAfterDays = 7,
    private unstableDays = 30,
    private itemsPerPage = 100,
    private updatedItemsPerPage = 100,
    private maxPages = 10
  ) {}

  abstract readonly cacheNs: string;
  abstract readonly graphqlQuery: string;
  abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;
  abstract isEquivalent(oldItem: StoredItem, newItem: StoredItem): boolean;

  async getItems(releasesConfig: GetReleasesConfig): Promise<StoredItem[]> {
    const { packageName, registryUrl } = releasesConfig;

    const updateDuration: DurationLike = { minutes: this.updateAfterMinutes };
    const resetDuration: DurationLike = { days: this.resetAfterDays };
    const stabilityDuration: DurationLike = { days: this.unstableDays };

    const now = DateTime.now();
    let cache: GithubDatasourceCache<StoredItem> = {
      items: {},
      cacheCreatedAt: now.toISO(),
      cacheUpdatedAt: now.minus(updateDuration).toISO(),
    };

    const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/');
    const [owner, name] = packageName.split('/');
    if (owner && name) {
      const cacheKey = `${baseUrl}:${owner}/${name}`;
      const cachedRes = await packageCache.get<
        GithubDatasourceCache<StoredItem>
      >(this.cacheNs, cacheKey);

      if (
        cachedRes &&
        !isExpired(now, cachedRes.cacheCreatedAt, resetDuration)
      ) {
        cache = cachedRes;
      }

      try {
        if (isExpired(now, cache.cacheUpdatedAt, updateDuration)) {
          const variables: GithubQueryParams = {
            owner,
            name,
            cursor: null,
            count:
              cache === cachedRes
                ? this.updatedItemsPerPage
                : this.itemsPerPage,
          };

          const checkedItems = new Set<string>();

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
                    isExpired(now, releaseTimestamp, stabilityDuration)
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
              !isExpired(now, item.releaseTimestamp, stabilityDuration) &&
              !checkedItems.has(version)
            ) {
              delete cache.items[version];
            }
          }

          const expiry = DateTime.fromISO(cache.cacheCreatedAt).plus(
            resetDuration
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
