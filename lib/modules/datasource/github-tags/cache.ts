import type {
  CacheOptions,
  GithubCachedTag,
  GithubGraphqlTag,
} from '../../../util/github/types';
import type { GithubHttp } from '../../../util/http/github';
import { AbstractGithubDatasourceCache } from '../github-releases/cache/cache-base';

const query = `
query ($owner: String!, $name: String!, $cursor: String, $count: Int!) {
  repository(owner: $owner, name: $name) {
    payload: refs(
      first: $count
      after: $cursor
      orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
      refPrefix: "refs/tags/"
    ) {
      nodes {
        version: name
        target {
          type: __typename
          ... on Commit {
            hash: oid
            releaseTimestamp: committedDate
          }
          ... on Tag {
            target {
              ... on Commit {
                hash: oid
              }
            }
            tagger {
              releaseTimestamp: date
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

export class CacheableGithubTags extends AbstractGithubDatasourceCache<
  GithubCachedTag,
  GithubGraphqlTag
> {
  readonly cacheNs = 'github-datasource-graphql-tags-v2';
  readonly graphqlQuery = query;

  constructor(http: GithubHttp, opts: CacheOptions = {}) {
    super(http, opts);
  }

  coerceFetched(item: GithubGraphqlTag): GithubCachedTag | null {
    const { version, target } = item;
    if (target.type === 'Commit') {
      const { hash, releaseTimestamp } = target;
      return { version, hash, releaseTimestamp };
    } else if (target.type === 'Tag') {
      const { hash } = target.target;
      const { releaseTimestamp } = target.tagger;
      return { version, hash, releaseTimestamp };
    }
    return null;
  }
}
