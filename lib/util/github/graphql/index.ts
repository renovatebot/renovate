import type { GithubHttp } from '../../http/github.ts';
import {
  fetchRestReleases,
  fetchRestTags,
  recoverFromIpAllowList,
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
 * Falls back to the REST API without a token if an IP allow list refused the token, because the GraphQL API can't be used without one.
 */
export async function queryTags(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubTagLookupItem[]> {
  try {
    return await GithubGraphqlDatasourceFetcher.query(
      config,
      http,
      tagsAdapter,
    );
  } catch (err) {
    return await recoverFromIpAllowList(err, config, () =>
      fetchRestTags(http, config),
    );
  }
}

/**
 * Falls back to the REST API without a token if an IP allow list refused the token, because the GraphQL API can't be used without one.
 */
export async function queryReleases(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubReleaseItem[]> {
  try {
    return await GithubGraphqlDatasourceFetcher.query(
      config,
      http,
      releasesAdapter,
    );
  } catch (err) {
    return await recoverFromIpAllowList(err, config, () =>
      fetchRestReleases(http, config),
    );
  }
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
