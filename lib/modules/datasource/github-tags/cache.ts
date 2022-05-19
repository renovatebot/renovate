import type { GithubHttp } from '../../../util/http/github';
import {
  AbstractGithubDatasourceCache,
  FetchedItemBase,
  StoredItemBase,
} from '../github-releases/cache-base';
import type { Release } from '../types';

const query = `
query ($owner: String!, $name: String!, $cursor: String, $count: Int!) {
  repository(owner: $owner, name: $name) {
    payload: refs(
      refPrefix: "refs/tags/"
      first: $count
      after: $cursor
      orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
    ) {
      nodes {
        version: name
        commit: target {
          ... on Commit {
            hash: oid
            releaseTimestamp: committedDate
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

interface FetchedTag extends FetchedItemBase {
  commit: {
    hash: string;
    releaseTimestamp: string;
  };
}

interface StoredTag extends StoredItemBase {
  hash: string;
  releaseTimestamp: string;
}

export class CacheableGithubTags extends AbstractGithubDatasourceCache<
  FetchedTag,
  StoredTag
> {
  readonly cacheNs = 'github-datasource-graphql-tags';
  readonly graphqlQuery = query;

  constructor(http: GithubHttp) {
    super(http);
  }

  coerceFetched(item: FetchedTag): StoredTag {
    const { version, commit } = item;
    return { version, ...commit };
  }

  coerceStored(item: StoredTag): Release {
    return {
      ...item,
      gitRef: item.version,
    };
  }

  isEquivalent(oldItem: StoredTag, newItem: StoredTag): boolean {
    return oldItem.hash === newItem.hash;
  }
}
