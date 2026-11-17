import type { GithubHttp } from '../../http/github.ts';
import { GithubGraphqlDatasourceFetcher } from './datasource-fetcher.ts';
import { adapter as branchesAdapter } from './query-adapters/branches-query-adapter.ts';
import { adapter as releasesAdapter } from './query-adapters/releases-query-adapter.ts';
import { adapter as tagsAdapter } from './query-adapters/tags-query-adapter.ts';
import type {
  GithubBranchItem,
  GithubPackageConfig,
  GithubReleaseItem,
  GithubTagItem,
} from './types.ts';

export async function queryTags(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubTagItem[]> {
  const res = await GithubGraphqlDatasourceFetcher.query(
    config,
    http,
    tagsAdapter,
  );
  return res;
}

export async function queryReleases(
  config: GithubPackageConfig,
  http: GithubHttp,
): Promise<GithubReleaseItem[]> {
  const res = await GithubGraphqlDatasourceFetcher.query(
    config,
    http,
    releasesAdapter,
  );
  return res;
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
