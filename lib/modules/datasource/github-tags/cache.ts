import type { GithubHttp } from '../../../util/http/github';
import { AbstractGithubDatasourceCache } from '../github-releases/cache/cache-base';
import type {
  CacheOptions,
  StoredItemBase,
} from '../github-releases/cache/types';

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
                releaseTimestamp: committedDate
              }
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

export interface FetchedTag {
  version: string;
  target:
    | {
        type: 'Commit';
        hash: string;
        releaseTimestamp: string;
      }
    | {
        type: 'Tag';
        target: {
          hash: string;
          releaseTimestamp: string;
        };
      };
}

export interface StoredTag extends StoredItemBase {
  hash: string;
  releaseTimestamp: string;
}

export class CacheableGithubTags extends AbstractGithubDatasourceCache<
  StoredTag,
  FetchedTag
> {
  readonly cacheNs = 'github-datasource-graphql-tags';
  readonly graphqlQuery = query;

  constructor(http: GithubHttp, opts: CacheOptions = {}) {
    super(http, opts);
  }

  coerceFetched(item: FetchedTag): StoredTag | null {
    const { version, target } = item;
    if (target.type === 'Commit') {
      const { hash, releaseTimestamp } = target;
      return { version, hash, releaseTimestamp };
    } else if (target.type === 'Tag') {
      const { hash, releaseTimestamp } = target.target;
      return { version, hash, releaseTimestamp };
    }
    return null;
  }
}
