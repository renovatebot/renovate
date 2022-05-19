import type { GithubHttp } from '../../../util/http/github';
import type { Release } from '../types';
import {
  AbstractGithubDatasourceCache,
  FetchedItemBase,
  StoredItemBase,
} from './cache-base';

export const query = `
query ($owner: String!, $name: String!, $cursor: String, $count: Int!) {
  repository(owner: $owner, name: $name) {
    payload: releases(
      first: $count
      after: $cursor
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
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

interface FetchedRelease extends FetchedItemBase {
  isDraft: boolean;
  isPrerelease: boolean;
  updatedAt: string;
  releaseTimestamp: string;
}

interface StoredRelease extends StoredItemBase {
  isStable?: boolean;
  updatedAt: string;
}

export class CacheableGithubReleases extends AbstractGithubDatasourceCache<
  FetchedRelease,
  StoredRelease
> {
  cacheNs = 'github-datasource-graphql-releases';
  graphqlQuery = query;

  constructor(http: GithubHttp) {
    super(http);
  }

  coerceFetched(item: FetchedRelease): StoredRelease {
    const { version, releaseTimestamp, isDraft, isPrerelease, updatedAt } =
      item;
    const result: StoredRelease = { version, releaseTimestamp, updatedAt };
    if (isPrerelease || isDraft) {
      result.isStable = false;
    }
    return result;
  }

  coerceStored(item: StoredRelease): Release {
    const { version, releaseTimestamp, isStable } = item;
    const result: Release = { version, releaseTimestamp };
    if (isStable !== undefined) {
      result.isStable = isStable;
    }
    return result;
  }

  isEquivalent(oldItem: StoredRelease, newItem: StoredRelease): boolean {
    return oldItem.releaseTimestamp === newItem.releaseTimestamp;
  }
}
