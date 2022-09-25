import { GithubGraphqlDatasourceHelper } from './datasource-helper';
import type {
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlTag,
  GithubTagItem,
} from './types';

const key = 'github-tags-datasource-v2';

const query = GithubGraphqlDatasourceHelper.prepareQuery(`
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
          newDigest: oid
          releaseTimestamp: committedDate
        }
        ... on Tag {
          target {
            ... on Commit {
              newDigest: oid
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
    const { newDigest, releaseTimestamp } = target;
    return { version, gitRef: version, newDigest, releaseTimestamp };
  } else if (target.type === 'Tag') {
    const { newDigest } = target.target;
    const { releaseTimestamp } = target.tagger;
    return { version, gitRef: version, newDigest, releaseTimestamp };
  }
  return null;
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlTag,
  GithubTagItem
> = { key, query, transform };
