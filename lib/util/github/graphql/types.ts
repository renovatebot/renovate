import type { PackageCacheNamespace } from '../../cache/package/types.ts';
import type { Timestamp } from '../../timestamp.ts';

export interface GithubDatasourceItem {
  version: string;
  releaseTimestamp: Timestamp;
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
  key: PackageCacheNamespace;

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

  /**
   * Maximum number of items to fetch. Undefined means unlimited.
   * When set, disables early termination based on stabilization.
   * Useful for refs that can't be sorted by date (e.g. branches).
   */
  maxItems?: number;
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
 * Result of GraphQL response transformation for branches
 */
export interface GithubBranchItem extends GithubDatasourceItem {
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
  finalizeAndReturn(): Promise<GithubItem[]>;
}
