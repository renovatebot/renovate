import type { GithubHttp } from '../../../util/http/github';
import { AbstractGithubDatasourceCache, StoredItemBase } from './cache-base';

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
        releaseTimestamp: publishedAt
        isDraft
        isPrerelease
        updatedAt
        url
        id: databaseId
        name
        description
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

export interface FetchedRelease {
  version: string;
  releaseTimestamp: string;
  isDraft: boolean;
  isPrerelease: boolean;
  updatedAt: string;
  url: string;
  id: number;
  name: string;
  description: string;
}

export interface StoredRelease extends StoredItemBase {
  isStable?: boolean;
  updatedAt: string;
  url: string;
  id: number;
  name: string;
  description: string;
}

export class CacheableGithubReleases extends AbstractGithubDatasourceCache<
  StoredRelease,
  FetchedRelease
> {
  cacheNs = 'github-datasource-graphql-releases';
  graphqlQuery = query;

  constructor(http: GithubHttp) {
    super(http);
  }

  coerceFetched(item: FetchedRelease): StoredRelease | null {
    const {
      version,
      releaseTimestamp,
      isDraft,
      isPrerelease,
      updatedAt,
      url,
      id,
      name,
      description,
    } = item;

    if (isDraft) {
      return null;
    }

    const result: StoredRelease = {
      version,
      releaseTimestamp,
      updatedAt,
      url,
      id,
      name,
      description,
    };

    if (isPrerelease) {
      result.isStable = false;
    }

    return result;
  }

  isEquivalent(oldItem: StoredRelease, newItem: StoredRelease): boolean {
    return oldItem.updatedAt === newItem.updatedAt;
  }
}
