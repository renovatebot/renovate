import type { GithubHttp } from '../../http/github.ts';
import {
  fetchRestReleases,
  fetchRestTags,
  withIpAllowListFallback,
} from '../rest-fallback.ts';
import { GithubGraphqlDatasourceFetcher } from './datasource-fetcher.ts';
import { adapter as branchesAdapter } from './query-adapters/branches-query-adapter.ts';
import { adapter as releasesAdapter } from './query-adapters/releases-query-adapter.ts';
import { adapter as tagsAdapter } from './query-adapters/tags-query-adapter.ts';
import type {
  GithubBranchItem,
  GithubPackageConfig,
  GithubReleaseItem,
  GithubTagLookupItem,
} from './types.ts';

/**
 * Uses the REST API without a token if an IP allow list refuses the token, because the GraphQL API can't be used without one.
 */
export function queryTags(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubTagLookupItem[]> {
  return withIpAllowListFallback(
    config,
    () => GithubGraphqlDatasourceFetcher.query(config, http, tagsAdapter),
    () => fetchRestTags(http, config),
  );
}

/**
 * Uses the REST API without a token if an IP allow list refuses the token, because the GraphQL API can't be used without one.
 */
export function queryReleases(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubReleaseItem[]> {
  return withIpAllowListFallback(
    config,
    () => GithubGraphqlDatasourceFetcher.query(config, http, releasesAdapter),
    () => fetchRestReleases(http, config),
  );
}

export async function queryBranches(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubBranchItem[]> {
  const res = await GithubGraphqlDatasourceFetcher.query(
    config,
    http,
    branchesAdapter,
  );
  return res;
}
