import { DateTime, DurationLike } from 'luxon';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import type {
  GithubGraphqlResponse,
  GithubHttp,
} from '../../../util/http/github';
import type { GetReleasesConfig, Release } from '../types';
import { getApiBaseUrl } from './common';

const softReset: DurationLike = { minutes: 30 };
const hardReset: DurationLike = { days: 7 };
const stabilityPeriod: DurationLike = { months: 1 };

const query = `
query(
  $owner: String!,
  $name: String!,
  $cursor: String,
  $count: Int!
) {
  repository(owner: $owner, name: $name) {
    releases(after: $cursor, first: $count, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        version: tagName
        gitRef: tagName
        releaseTimestamp: publishedAt
        isDraft
        isPrerelease
        updatedAt
      }

      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

interface QueryParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

interface QueryResponse {
  repository: {
    releases: {
      nodes: FetchedItem[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}

interface ItemBase {
  version: string;
  releaseTimestamp: string;
}

interface FetchedItem extends ItemBase {
  isDraft: boolean;
  isPrerelease: boolean;
  updatedAt: string;
}

interface CachedItem extends ItemBase {
  gitRef: string;
  isStable?: boolean;
}

interface GithubReleasesCache {
  releases: Record<string, CachedItem>;
  releasesUpdatedAt: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

function coerceFetchedItem(item: FetchedItem): CachedItem {
  const { version, releaseTimestamp, isDraft, isPrerelease } = item;
  const gitRef = version;
  const result: CachedItem = { version, gitRef, releaseTimestamp };
  if (isPrerelease || isDraft) {
    result.isStable = false;
  }
  return result;
}

function createCache(now: DateTime): GithubReleasesCache {
  return {
    releases: {},
    releasesUpdatedAt: {},
    createdAt: now.toISO(),
    updatedAt: now.minus(softReset).toISO(),
  };
}

function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLike
): boolean {
  const then = DateTime.fromISO(date);
  return now >= then.plus(duration);
}

export async function getCacheableReleases(
  http: GithubHttp,
  config: GetReleasesConfig
): Promise<Release[]> {
  const now = DateTime.now();
  let cache: GithubReleasesCache = createCache(now);
  const { packageName, registryUrl } = config;

  const baseUrl = getApiBaseUrl(registryUrl).replace('/v3/', '/');
  const [owner, name] = packageName.split('/');
  if (owner && name) {
    const cacheNs = `datasource-github-releases-graphql`;
    const cacheKey = `${baseUrl}:${owner}/${name}`;
    const cachedRes = await packageCache.get<GithubReleasesCache>(
      cacheNs,
      cacheKey
    );

    let isCacheUpdated = false;

    if (cachedRes && !isExpired(now, cachedRes.createdAt, hardReset)) {
      cache = cachedRes;
    } else {
      isCacheUpdated = true;
    }

    if (isExpired(now, cache.updatedAt, softReset)) {
      const variables: QueryParams = {
        owner,
        name,
        cursor: null,
        count: 100,
      };

      const checkedItems = new Set<string>();

      try {
        let pagesAllowed = 10;
        let isIterating = true;
        while (pagesAllowed > 0 && isIterating) {
          const graphqlRes = await http.postJson<
            GithubGraphqlResponse<QueryResponse>
          >('/graphql', {
            baseUrl,
            body: { query, variables },
          });
          pagesAllowed -= 1;

          const data = graphqlRes.body.data;
          if (data) {
            const {
              nodes: fetchedItems,
              pageInfo: { hasNextPage, endCursor },
            } = data.repository.releases;

            if (!hasNextPage) {
              isIterating = false;
            } else {
              variables.cursor = endCursor;
            }

            for (const item of fetchedItems) {
              const { version, releaseTimestamp, updatedAt } = item;
              checkedItems.add(version);

              const storedItem = cache.releases[version];
              const storedItemUpdatedAt = cache.releasesUpdatedAt[version];
              if (!storedItem || storedItemUpdatedAt !== updatedAt) {
                cache.releases[version] = coerceFetchedItem(item);
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
          `GitHub releases: error fetching cacheable GraphQL data`
        );
      }

      for (const [version, item] of Object.entries(cache.releases)) {
        if (
          !isExpired(now, item.releaseTimestamp, stabilityPeriod) &&
          !checkedItems.has(version)
        ) {
          delete cache.releases[version];
          isCacheUpdated = true;
        }
      }

      if (isCacheUpdated) {
        const expiry = DateTime.fromISO(cache.createdAt).plus(hardReset);
        const { minutes: ttlMinutes } = expiry
          .diff(now, ['minutes'])
          .toObject();
        if (ttlMinutes && ttlMinutes > 0) {
          cache.updatedAt = now.toISO();
          await packageCache.set(cacheNs, cacheKey, cache, ttlMinutes);
        }
      }
    }
  }

  const result = Object.values(cache.releases);
  return result;
}
