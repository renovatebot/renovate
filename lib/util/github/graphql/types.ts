export interface GithubDatasourceItem {
  version: string;
  releaseTimestamp: string;
}

/**
 * Datasource-specific structure
 */
export interface GithubGraphqlDatasourceAdapter<
  Input,
  Output extends GithubDatasourceItem,
> {
  /**
   * Used for creating datasource-unique cache key
   */
  key: string;

  /**
   * Used to define datasource-unique GraphQL query
   */
  query: string;

  /**
   * Used for transforming GraphQL nodes to objects
   * that have `version` and `releaseTimestamp` fields.
   *
   * @param input GraphQL node data
   */
  transform(input: Input): Output | null;
}

export type RawQueryResponse<Payload> = [Payload, null] | [null, Error];

export interface GithubGraphqlPayload<T> {
  nodes: T[];
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string;
  };
}

export interface GithubGraphqlRepoResponse<T> {
  repository: {
    isRepoPrivate?: boolean;
    payload: GithubGraphqlPayload<T>;
  };
}

export interface GithubPackageConfig {
  /**
   * Example: renovatebot/renovate
   */
  packageName: string;

  /**
   * Default: https://api.github.com
   */
  registryUrl?: string | undefined;
}

/**
 * Result of GraphQL response transformation for releases (via adapter)
 */
export interface GithubReleaseItem extends GithubDatasourceItem {
  isStable?: boolean;
  url: string;
  id?: number;
  name?: string;
  description?: string;
}

/**
 * Result of GraphQL response transformation for tags (via tags)
 */
export interface GithubTagItem extends GithubDatasourceItem {
  hash: string;
  gitRef: string;
}

/**
 * Parameters being passed as GraphQL variables
 */
export interface GithubGraphqlRepoParams {
  owner: string;
  name: string;
  cursor: string | null;
  count: number;
}

export interface GithubGraphqlCacheRecord<
  GithubItem extends GithubDatasourceItem,
> {
  items: Record<string, GithubItem>;
  createdAt: string;
}

export interface GithubGraphqlCacheStrategy<
  GithubItem extends GithubDatasourceItem,
> {
  reconcile(items: GithubItem[]): Promise<boolean>;
  finalize(): Promise<GithubItem[]>;
}
