import { LRUCache } from 'lru-cache';
import type { GithubHttp } from '../../http/github';
import { GithubGraphqlDatasourceFetcher } from './datasource-fetcher';
import { adapter as releasesAdapter } from './query-adapters/releases-query-adapter';
import { adapter as tagsAdapter } from './query-adapters/tags-query-adapter';
import type {
  GithubPackageConfig,
  GithubReleaseItem,
  GithubTagItem,
} from './types';

let fastCache: LRUCache<string, any> | null = null;

export function setupCache(opts: LRUCache.Options<string, any, unknown>): void {
  fastCache = new LRUCache<string, any>(opts);
}

export function resetCache(): void {
  fastCache = null;
}

export async function queryTags(
  config: GithubPackageConfig,
  http: GithubHttp
): Promise<GithubTagItem[]> {
  const res = await GithubGraphqlDatasourceFetcher.query(
    config,
    http,
    tagsAdapter,
    fastCache
  );
  return res;
}

export async function queryReleases(
  config: GithubPackageConfig,
  http: GithubHttp
): Promise<GithubReleaseItem[]> {
  const res = await GithubGraphqlDatasourceFetcher.query(
    config,
    http,
    releasesAdapter,
    fastCache
  );
  return res;
}
