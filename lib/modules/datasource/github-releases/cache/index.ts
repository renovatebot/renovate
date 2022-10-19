import type {
  CacheOptions,
  GithubCachedRelease,
  GithubGraphqlRelease,
} from '../../../../util/github/types';
import type { GithubHttp } from '../../../../util/http/github';
import { AbstractGithubDatasourceCache } from './cache-base';

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

export class CacheableGithubReleases extends AbstractGithubDatasourceCache<
  GithubCachedRelease,
  GithubGraphqlRelease
> {
  cacheNs = 'github-datasource-graphql-releases';
  graphqlQuery = query;

  constructor(http: GithubHttp, opts: CacheOptions = {}) {
    super(http, opts);
  }

  coerceFetched(item: GithubGraphqlRelease): GithubCachedRelease | null {
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

    const result: GithubCachedRelease = {
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
