import { GithubGraphqlDatasourceFetcher } from './datasource-fetcher';
import type {
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlTag,
  GithubTagItem,
} from './types';

const key = 'github-tags-datasource-v2';

const query = GithubGraphqlDatasourceFetcher.prepareQuery(`
  refs(
    first: $count
    after: $cursor
    orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
    refPrefix: "refs/tags/"
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      version: name
      target {
        type: __typename
        ... on Commit {
          oid
          releaseTimestamp: committedDate
        }
        ... on Tag {
          target {
            ... on Commit {
              oid
            }
          }
          tagger {
            releaseTimestamp: date
          }
        }
      }
    }
  }`);

function transform(item: GithubGraphqlTag): GithubTagItem | null {
  const { version, target } = item;
  if (target.type === 'Commit') {
    const { oid: hash, releaseTimestamp } = target;
    return { version, gitRef: version, hash, releaseTimestamp };
  } else if (target.type === 'Tag') {
    const { oid: hash } = target.target;
    const { releaseTimestamp } = target.tagger;
    return { version, gitRef: version, hash, releaseTimestamp };
  }
  return null;
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlTag,
  GithubTagItem
> = { key, query, transform };
