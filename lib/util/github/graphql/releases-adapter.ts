import { GithubGraphqlDatasourceHelper } from './datasource-helper';
import type {
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlRelease,
  GithubReleaseItem,
} from './types';

const key = 'github-releases-datasource-v2';

const query = GithubGraphqlDatasourceHelper.prepareQuery(`
  releases(
    first: $count
    after: $cursor
    orderBy: {field: CREATED_AT, direction: DESC}
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
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
  }
`);

function transform(item: GithubGraphqlRelease): GithubReleaseItem | null {
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

  const result: GithubReleaseItem = {
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

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlRelease,
  GithubReleaseItem
> = { key, query, transform };
