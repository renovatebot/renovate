export interface GithubDatasourceItem {
  version: string;
  releaseTimestamp: string;
}

export interface GithubGraphqlDatasourceAdapter<
  Input,
  Output extends GithubDatasourceItem
> {
  key: string;
  query: string;
  transform(input: Input): Output | null;
}

export type RawQueryResponse<Payload> = [Payload, null] | [null, Error];

export interface GithubGraphqlRepoResponsePayload<T> {
  nodes: T[];
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string;
  };
}

export interface GithubGraphqlRepoResponse<T> {
  repository: {
    isPrivate?: boolean;
    payload: GithubGraphqlRepoResponsePayload<T>;
  };
}

export type GithubGraphqlPayload<T> =
  GithubGraphqlRepoResponse<T>['repository']['payload'] & {
    isRepoPrivate: GithubGraphqlRepoResponse<T>['repository']['isPrivate'];
  };

export interface GithubPackageConfig {
  packageName: string;
  registryUrl?: string;
}

/**
 * GraphQL shape for releases
 */
export interface GithubGraphqlRelease {
  version: string;
  releaseTimestamp: string;
  isDraft: boolean;
  isPrerelease: boolean;
  url: string;
  id: number;
  name: string;
  description: string;
}

export interface GithubReleaseItem extends GithubDatasourceItem {
  isStable?: boolean;
  url: string;
  id: number;
  name: string;
  description: string;
}

/**
 * GraphQL shape for tags
 */
export interface GithubGraphqlTag {
  version: string;
  target:
    | {
        type: 'Commit';
        newDigest: string;
        releaseTimestamp: string;
      }
    | {
        type: 'Tag';
        target: {
          newDigest: string;
        };
        tagger: {
          releaseTimestamp: string;
        };
      };
}

export interface GithubTagItem extends GithubDatasourceItem {
  newDigest: string;
  gitRef: string;
}

export interface GithubGraphqlRepoParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}
