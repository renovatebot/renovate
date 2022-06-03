import type { GithubHttp } from '../../../../util/http/github';
import { AbstractGithubDatasourceCache } from './cache-base';
import type { CacheOptions, StoredItemBase } from './types';

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
  url: string;
  id: number;
  name: string;
  description: string;
}

export interface StoredRelease extends StoredItemBase {
  isStable?: boolean;
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

  constructor(http: GithubHttp, opts: CacheOptions = {}) {
    super(http, opts);
  }

  coerceFetched(item: FetchedRelease): StoredRelease | null {
    const {
      version,
      releaseTimestamp,
      isDraft,
      isPrerelease,
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
}
